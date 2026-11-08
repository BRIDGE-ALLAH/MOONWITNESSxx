import type { WitnessEvent, WitnessSnapshot, WitnessLedger } from "./index.ts";
import { WitnessLedger as Ledger } from "./index.ts";
import { buildClaimGenome, type ClaimGenome } from "./experiments.ts";
import { createSignedCheckpoint, verifySignedCheckpoint, type SignedWitnessCheckpoint } from "./checkpoint.ts";

export interface EvidenceFlightRecorderBundle {
  format: "moonwitness-evidence-flight-recorder";
  version: 1;
  exportedAt: string;
  events: readonly WitnessEvent[];
  snapshot: WitnessSnapshot;
  genome: ClaimGenome;
  checkpoint: SignedWitnessCheckpoint;
}
export interface FlightRecorderVerification {
  valid: boolean;
  errors: string[];
  eventCount: number;
  headHash: string;
}
export async function createEvidenceFlightRecorder(
  ledger: WitnessLedger, privateKey: CryptoKey, exportedAt = new Date().toISOString()
): Promise<EvidenceFlightRecorderBundle> {
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error("exportedAt must be a valid timestamp");
  const events = ledger.events();
  const integrity = await ledger.verify();
  if (!integrity.valid) throw new Error("cannot export an invalid evidence ledger");
  return {
    format: "moonwitness-evidence-flight-recorder",
    version: 1,
    exportedAt,
    events,
    snapshot: ledger.replay(),
    genome: buildClaimGenome(events),
    checkpoint: await createSignedCheckpoint(events, privateKey, exportedAt)
  };
}
export async function verifyEvidenceFlightRecorder(
  bundle: EvidenceFlightRecorderBundle, publicKey: CryptoKey
): Promise<FlightRecorderVerification> {
  const errors: string[] = [];
  if (bundle.format !== "moonwitness-evidence-flight-recorder" || bundle.version !== 1) errors.push("unsupported bundle format");
  const ledger = new Ledger();
  try {
    for (const event of bundle.events) {
      const { sequence: _sequence, previousHash: _previousHash, hash: _hash, ...input } = event;
      await ledger.append(input);
    }
  } catch (error) {
    errors.push("event reconstruction failed: " + (error instanceof Error ? error.message : String(error)));
  }
  const integrity = await ledger.verify();
  if (!integrity.valid) errors.push(...integrity.errors);
  const snapshot = ledger.replay();
  if (JSON.stringify(snapshot) !== JSON.stringify(bundle.snapshot)) errors.push("snapshot does not match deterministic replay");
  if (JSON.stringify(buildClaimGenome(bundle.events)) !== JSON.stringify(bundle.genome)) errors.push("claim genome does not match event history");
  if (!(await verifySignedCheckpoint(bundle.checkpoint, publicKey, ledger.events()))) errors.push("checkpoint signature or ledger anchor is invalid");
  return { valid: errors.length === 0, errors, eventCount: integrity.checked, headHash: integrity.headHash };
}
