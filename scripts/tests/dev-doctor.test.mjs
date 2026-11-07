import test from "node:test";
import assert from "node:assert/strict";
import { findRecursiveRootScripts, minimumPnpmMajor, validateRootManifest } from "../dev-doctor.mjs";

test("detects direct self-recursive root scripts", () => {
  assert.deepEqual(findRecursiveRootScripts({
    "format:check": "pnpm run format && pnpm run format:check",
    "type-check": "pnpm run typecheck",
    lint: "turbo run lint"
  }), ["format:check"]);
});

test("reads minimum pnpm major from supported engine ranges", () => {
  assert.equal(minimumPnpmMajor(">=9"), 9);
  assert.equal(minimumPnpmMajor(">=12.4"), 12);
  assert.ok(Number.isNaN(minimumPnpmMajor("")));
});

test("validates package-manager pin and formatting check command", () => {
  const failures = validateRootManifest({
    packageManager: "pnpm@12.16.1",
    scripts: { "format:check": "prettier --check ." }
  }, "/path/that/does/not/exist");
  assert.ok(failures.some((failure) => failure.includes("pnpm-lock.yaml")));
  assert.ok(failures.some((failure) => failure.includes("pnpm-workspace.yaml")));
  assert.equal(failures.some((failure) => failure.includes("format:check")), false);
});

test("rejects missing package-manager pin and broken format gate", () => {
  const failures = validateRootManifest({ scripts: { "format:check": "pnpm run format:check" } }, "/missing");
  assert.ok(failures.some((failure) => failure.includes("packageManager")));
  assert.ok(failures.some((failure) => failure.includes("format:check")));
  assert.ok(failures.some((failure) => failure.includes('root script "format:check"')));
});
