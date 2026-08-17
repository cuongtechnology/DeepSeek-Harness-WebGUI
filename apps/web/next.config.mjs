/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deepseek-harness/ui', '@deepseek-harness/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
