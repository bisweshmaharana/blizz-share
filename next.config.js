/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
  },
  env: {
    APP_URL: process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : process.env.APP_URL,
  },
  swcMinify: true,
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
  },
};

module.exports = nextConfig;
