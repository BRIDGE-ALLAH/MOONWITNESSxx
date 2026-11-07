import type { WitnessEvent } from "./index.ts";

export interface SignedWitnessCheckpoint {
  version: 1;
  sequence: number;
  headHash: string;
  createdAt: string;
  algorithm: "Ed25519";
  signature: string;
}
const bytes = (value: string) => new TextEncoder().encode(value);
const toBase64 = (value: Uint8Array) => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const payload = (checkpoint: Omit<SignedWitnessCheckpoint, "signature">) =>
  JSON.stringify({ version: checkpoint.version, sequence: checkpoint.sequence, headHash: checkpoint.headHash, createdAt: checkpoint.createdAt, algorithm: checkpoint.algorithm });
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
};
async function verifyEventChain(events: readonly WitnessEvent[]): Promise<boolean> {
  let previousHash = "0".repeat(64);
  for (const [index, event] of events.entries()) {
    const { hash, ...body } = event;
    if (event.sequence !== index + 1 || event.previousHash !== previousHash) return false;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(body)));
    const computed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (computed !== hash) return false;
    previousHash = hash;
  }
  return true;
}

export async function createSignedCheckpoint(
  events: readonly WitnessEvent[], privateKey: CryptoKey, createdAt = new Date().toISOString()
): Promise<SignedWitnessCheckpoint> {
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("createdAt must be a valid timestamp");
  const head = events.at(-1);
  const unsigned = {
    version: 1 as const,
    sequence: events.length,
    headHash: head?.hash ?? "0".repeat(64),
    createdAt,
    algorithm: "Ed25519" as const
  };
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, bytes(payload(unsigned)));
  return { ...unsigned, signature: toBase64(new Uint8Array(signature)) };
}

export async function verifySignedCheckpoint(
  checkpoint: SignedWitnessCheckpoint, publicKey: CryptoKey, events: readonly WitnessEvent[]
): Promise<boolean> {
  if (checkpoint.version !== 1 || checkpoint.algorithm !== "Ed25519") return false;
  if (!Number.isFinite(Date.parse(checkpoint.createdAt))) return false;
  if (checkpoint.sequence !== events.length || checkpoint.headHash !== (events.at(-1)?.hash ?? "0".repeat(64))) return false;
  if (!(await verifyEventChain(events))) return false;
  const { signature, ...unsigned } = checkpoint;
  try {
    return await crypto.subtle.verify({ name: "Ed25519" }, publicKey, fromBase64(signature), bytes(payload(unsigned)));
  } catch {
    return false;
  }
}
