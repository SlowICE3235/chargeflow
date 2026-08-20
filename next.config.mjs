/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Descomente a linha abaixo para gerar exportacao estatica
  // (limita funcionalidades dinamicas como API routes e Server Actions)
  // output: 'export',
  // distDir: 'dist',
};

export default nextConfig;
