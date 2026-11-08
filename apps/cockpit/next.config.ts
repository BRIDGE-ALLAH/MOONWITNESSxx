import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  transpilePackages: ['@riotworks/ui', '@riotworks/assets'],
}

export default nextConfig
