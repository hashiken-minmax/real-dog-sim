/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  experimental: {
    esmExternals: 'loose',
  },
};

module.exports = nextConfig;