// Bootstrap entry point: loads the centralized root .env BEFORE the rest of
// the app is imported, so every module sees the right process.env values.
//
// This must stay a separate file from server.ts. In ESM, static `import`
// statements are hoisted and evaluated before any other code in a module —
// so if server.ts imported dotenv itself, extractor.ts (which reads
// process.env at module-load time) would already have been evaluated first.
// Using a dynamic import() here guarantees strict ordering: config first,
// then app.
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Works both in dev (tsx, running from src/) and prod (compiled to dist/) —
// both are two directories below the repo root.
config({ path: path.resolve(__dirname, "../../.env") });

await import("./server.js");
