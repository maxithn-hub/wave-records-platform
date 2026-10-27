/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@wave/contracts', '@wave/domain-core', '@wave/api-client'],
  reactStrictMode: true,
  async rewrites() {
    const apiBase = process.env.WAVE_API_INTERNAL_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
