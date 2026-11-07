import type { Config } from 'tailwindcss'
import uiConfig from '@riotworks/ui/tailwind.config'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [uiConfig],
  theme: {
    extend: {},
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
