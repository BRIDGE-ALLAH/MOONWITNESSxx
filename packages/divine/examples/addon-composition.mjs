import { createDivineRuntime } from "../src/index.ts";

const addon = {
  manifest: {
    id: "example.audit-trace",
    version: "1.0.0",
    capabilities: ["research.audit-trace"],
  },
  initialize(context) {
    if (!context.capabilities.includes("research.audit-trace")) {
      throw new Error("Required research capability was not granted.");
    }
  },
  dispose() {},
};

const context = {
  capabilities: ["research.audit-trace"],
  locale: "id-ID",
  traceId: "example-addon-composition",
  methods: new Map(),
  adapters: {},
};

const runtime = await createDivineRuntime([addon], context);
console.log("Addon graph active:", runtime.state, runtime.addons.map(item => item.manifest.id));
await runtime.dispose();
console.log("Addon graph disposed:", runtime.state);
