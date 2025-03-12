/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    APP_URL: process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : process.env.APP_URL,
  },
  swcMinify: true,
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
  },
  webpack: (config, { isServer }) => {
    // Fix module resolution issues
    config.resolve.fallback = { fs: false, path: false };
    
    // Ensure proper module resolution for components
    config.resolve.modules = ['node_modules', './src'];
    
    return config;
  },
  // Ensure proper transpilation
  transpilePackages: ['react-qr-code', 'qrcode.react'],
};

module.exports = nextConfig;
