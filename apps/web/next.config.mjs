/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGithubPages ? '/wave-records-platform' : '';

const nextConfig = {
  transpilePackages: ['@wave/contracts', '@wave/domain-core', '@wave/api-client'],
  reactStrictMode: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  ...(isGithubPages
    ? {
        output: 'export',
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
