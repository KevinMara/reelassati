/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled to ease the React Router integration transition
  swcMinify: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  // API routes are handled via app/api/*
  // All other routes are captured by [[...slug]]/page.tsx for React Router
};

module.exports = nextConfig;
