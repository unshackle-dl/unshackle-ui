import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone build for self-hosting
  output: 'standalone',

  // Allow cross-origin requests during development
  allowedDevOrigins: ['95.168.172.167:3000', '136.243.106.220:3000', '136.243.106.220'],

  // Optimize for production
  experimental: {
    optimizePackageImports: ['@/components/ui', 'lucide-react'],
    // Increase default execution time for API routes to 5 minutes (300 seconds)
    // This allows list-tracks operations to complete (can take 2-5 minutes)
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
