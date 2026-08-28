import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  experimental: {
    // Rewrite barrel imports to deep paths so unused Chakra/framer surface never
    // reaches the client bundle.
    optimizePackageImports: ["@chakra-ui/react", "framer-motion"],
  },
};

export default nextConfig;
