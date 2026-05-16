import type { NextConfig } from "next";

/**
 * next.config.ts — FlowZen
 *
 * output: "standalone" is REQUIRED for the Docker image.
 * It tells Next.js to bundle everything the server needs into
 * .next/standalone so the production image doesn't need the full
 * node_modules tree — cutting image size significantly.
 */
const nextConfig: NextConfig = {
  output: "standalone",

  // Allow images from external domains if you add next/image usage later
  images: {
    remotePatterns: [],
  },

  // Silence TypeScript / ESLint errors during Docker build
  // (run lint as a separate CI step instead)
  typescript: {
    ignoreBuildErrors: false,
  },
  // eslint config is no longer part of NextConfig in Next.js 16+
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
};

export default nextConfig;