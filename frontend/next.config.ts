import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack resolves modules from the frontend app, not workspace root.
    root: __dirname,
  },
};

export default nextConfig;
