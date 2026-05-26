/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure we don't try to pre-render dynamic routes that depend on client-side state
  trailingSlash: false,
};

module.exports = nextConfig;
