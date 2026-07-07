import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load the centralized root .env (one directory up from frontend/) so
// BACKEND_HOST/BACKEND_PORT/etc. are available to API routes at runtime.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
