import type { NextConfig } from "next";

const target = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small production container.
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
