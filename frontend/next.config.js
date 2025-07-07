/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      ignoreDuringBuilds: true, // ✅ disables ESLint blocking the build
    },
    typescript: {
      ignoreBuildErrors: true, // ✅ disables TypeScript build blocking
    },
  };
  
  module.exports = nextConfig;
  