import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@riotworks/ui', '@riotworks/assets', '@riotworks/contract'],
}

export default nextConfig
