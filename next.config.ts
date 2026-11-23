import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its WebAssembly and data files from its own package folder, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  async redirects() {
    return [
      // The Job market page became part of the Best platforms page on 23 November 2026. Permanent (308),
      // so saved links and search results move with it.
      { source: "/market", destination: "/platforms", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
