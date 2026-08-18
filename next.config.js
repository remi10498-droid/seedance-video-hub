/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true, // Принудительно включаем App Router, если он не включился
  },
}

module.exports = nextConfig
