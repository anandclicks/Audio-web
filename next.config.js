/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Bundle the committed SQLite DB + uploaded media into the serverless
    // functions so they exist at runtime on hosts like Vercel. Without this,
    // Next's file tracing leaves them out and Prisma reports
    // "Unable to open the database file".
    outputFileTracingIncludes: {
      "/api/**": ["./prisma/dev.db", "./data/uploads/**/*"],
    },
  },
};

module.exports = nextConfig;
