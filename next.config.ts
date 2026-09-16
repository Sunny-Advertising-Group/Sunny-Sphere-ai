import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    // Default is 1MB, too small for a monthly wrap HTML export (styling,
    // inline charts, etc. easily exceed it) — this is a Server Action, so
    // the file rides in the request body, not a direct-to-storage upload.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
