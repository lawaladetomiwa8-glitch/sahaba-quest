import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CLOUDFLARE_SITE_KEY:
      process.env.CLOUDFLARE_SITE_KEY ?? "",
  },
};

export default nextConfig;
