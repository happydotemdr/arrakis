/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features as needed
    typedRoutes: true,
    // Silence workspace root warning
    outputFileTracingRoot: require('path').join(__dirname),
  },
  typescript: {
    // Type checking is handled by CI/CD pipeline
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint checking is handled by CI/CD pipeline
    ignoreDuringBuilds: false,
  },
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,
  // Optimize images
  images: {
    domains: [],
  },
  // Redirect trailing slashes
  trailingSlash: false,
  // PoweredByHeader
  poweredByHeader: false,
  // Compression
  compress: true,
}

module.exports = nextConfig