/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  transpilePackages: ['@wave/contracts', '@wave/domain-core', '@wave/api-client'],
  reactStrictMode: true,
  ...(isGithubPages
    ? {
        output: 'export',
        basePath: '/wave-records-platform',
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          const apiBase = process.env.WAVE_API_INTERNAL_URL ?? 'http://localhost:4000';
          return [
            {
              source: '/api/:path*',
              destination: `${apiBase}/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
