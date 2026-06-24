import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@react-pdf/renderer` (e as suas dependências de fontes/streams) bundla de
  // forma mais fiável fora do bundler do servidor — usado na Route Handler da
  // ficha de jogo em PDF.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
