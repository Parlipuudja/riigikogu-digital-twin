const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Riigikogu
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.riigikogu.ee",
        pathname: "/**",
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
