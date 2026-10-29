import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CLOUDFLARE_SITE_KEY:
      process.env.CLOUDFLARE_SITE_KEY ?? "",
  },
  async redirects() {
    return [
      {
        source: "/sahabah",
        destination: "/sahaba",
        permanent: true,
      },
      {
        source: "/sahabah/:slug",
        destination: "/sahaba/:slug",
        permanent: true,
      },
      {
        source: "/signup/sponsored-competitions",
        destination: "/sponsored-competitions",
        permanent: true,
      },
      {
        source: "/signup/sponsored-competitions/:path*",
        destination: "/sponsored-competitions/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
