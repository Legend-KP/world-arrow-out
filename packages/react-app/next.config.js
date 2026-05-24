/** @type {import('next').NextConfig} */
const path = require("path");
const dotenv = require("dotenv");

// Monorepo env files (root + react-app)
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local") });

if (!process.env.NEXT_PUBLIC_APP_ID) {
  process.env.NEXT_PUBLIC_APP_ID =
    process.env.WORLD_APP_ID ||
    process.env.APP_ID ||
    "";
}

if (!process.env.NEXT_PUBLIC_WORLD_RECEIVING_WALLET) {
  process.env.NEXT_PUBLIC_WORLD_RECEIVING_WALLET =
    process.env.WORLD_RECEIVING_WALLET ||
    "";
}

if (!process.env.APP_ID) {
  process.env.APP_ID =
    process.env.NEXT_PUBLIC_APP_ID ||
    process.env.WORLD_APP_ID ||
    "";
}

if (!process.env.DEV_PORTAL_API_KEY) {
  process.env.DEV_PORTAL_API_KEY =
    process.env.WORLD_API_KEY ||
    "";
}

const publicAppId = process.env.NEXT_PUBLIC_APP_ID || "";
const publicReceivingWallet =
  process.env.NEXT_PUBLIC_WORLD_RECEIVING_WALLET || "";

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Force embed into client bundle at build time
  env: {
    NEXT_PUBLIC_APP_ID: publicAppId,
    NEXT_PUBLIC_WORLD_RECEIVING_WALLET: publicReceivingWallet,
  },
  serverExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-production-opera-website.operacdn.com",
      },
    ],
  },
};

module.exports = nextConfig;

if (process.env.NODE_ENV === "development") {
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}
