import test from "node:test";
import assert from "node:assert/strict";
import { assessSourceLineageIndependence, createProvenanceAssuranceCapsule, runProvenanceAttackSuite, verifyProvenanceAssuranceCapsule } from "../src/provenance-assurance/index.ts";
const records = [
  { sourceRef: "source:a", familyId: "family:a", parentSourceRefs: [], lineageComplete: true },
  { sourceRef: "source:b", familyId: "family:b", parentSourceRefs: [], lineageComplete: true },
];
test("distinct complete lineages with distinct declared families are independent", () => {
  const result = assessSourceLineageIndependence({ records, selectedSourceRefs: ["source:b", "source:a"] });
  assert.equal(result.status, "independent");
  assert.deepEqual(result.selectedSourceRefs, ["source:a", "source:b"]);
});
test("shared transitive ancestor defeats apparently distinct witness families", () => {
  const graph = [...records.filter((record) => record.sourceRef !== "source:a" && record.sourceRef !== "source:b"),
    { sourceRef: "source:root", familyId: "family:root", parentSourceRefs: [], lineageComplete: true },
    { ...records[0], parentSourceRefs: ["source:root"] }, { ...records[1], parentSourceRefs: ["source:root"] }];
  const result = assessSourceLineageIndependence({ records: graph, selectedSourceRefs: ["source:a", "source:b"] });
  assert.equal(result.status, "dependent");
  assert.deepEqual(result.sharedAncestorRefs, ["source:root"]);
});
test("missing lineage and missing family fail closed as unknown", () => {
  const incomplete = records.map((record) => record.sourceRef === "source:b" ? { ...record, familyId: undefined, lineageComplete: false } : record);
  const result = assessSourceLineageIndependence({ records: incomplete, selectedSourceRefs: ["source:a", "source:b"] });
  assert.equal(result.status, "unknown");
  assert.ok(result.reasonCodes.includes("witness-family-unassigned"));
  assert.ok(result.reasonCodes.includes("lineage-incomplete-or-missing"));
});
test("family collisions and cycles never pass as independent", () => {
  const collision = records.map((record) => record.sourceRef === "source:b" ? { ...record, familyId: "family:a" } : record);
  assert.equal(assessSourceLineageIndependence({ records: collision, selectedSourceRefs: ["source:a", "source:b"] }).status, "dependent");
  const cycle = records.map((record) => record.sourceRef === "source:a" ? { ...record, parentSourceRefs: ["source:b"] } : { ...record, parentSourceRefs: ["source:a"] });
  assert.equal(assessSourceLineageIndependence({ records: cycle, selectedSourceRefs: ["source:a", "source:b"] }).status, "unknown");
});
test("red-team suite detects false-independence mutations", () => {
  const report = runProvenanceAttackSuite({ records, selectedSourceRefs: ["source:a", "source:b"] });
  assert.equal(report.results.length, 5);
  assert.deepEqual(report.falseAcceptances, []);
});
test("assurance capsule binds scope, method, release, lineage and assessment", async () => {
  const capsule = await createProvenanceAssuranceCapsule({ claimRef: "corpus:assertion:1", corpusRelease: "release:1", methodVersion: "lineage-check:1.0.0", scope: { tradition: "corpus:tradition:1", period: "corpus:period:1" }, records, selectedSourceRefs: ["source:a", "source:b"] });
  assert.equal((await verifyProvenanceAssuranceCapsule(capsule, records)).valid, true);
  const changed = records.map((record) => record.sourceRef === "source:b" ? { ...record, familyId: "family:changed" } : record);
  const verification = await verifyProvenanceAssuranceCapsule(capsule, changed);
  assert.equal(verification.valid, false);
  assert.ok(verification.errors.includes("Source lineage graph digest mismatch"));
});
