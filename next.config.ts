import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone build for self-hosting
  output: 'standalone',

  // Allow cross-origin requests during development
  allowedDevOrigins: ['http://95.168.172.167:3000'],

  // Optimize for production
  experimental: {
    optimizePackageImports: ['@/components/ui', 'lucide-react'],
  },

  // Image optimization for external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'images.justwatch.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.justwatch.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wsrv.nl',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Compress output
  compress: true,

  // PoweredByHeader for security
  poweredByHeader: false,

  // Environment variables validation
  env: {
    DATABASE_PATH: process.env.DATABASE_PATH,
  },
};

export default nextConfig;
