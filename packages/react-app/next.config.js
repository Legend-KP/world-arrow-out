/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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