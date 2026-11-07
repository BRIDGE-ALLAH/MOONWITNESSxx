/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // RIOTWORKS brand palette
        obsidian: '#111315',
        'deep-industrial': '#191C1E',
        'panel-charcoal': '#24282A',
        'paper-bone': '#F3EBDD',
        'acid-lime': '#D2FF38',
        'riot-orange': '#FF542D',
        'electric-blue': '#40D9FF',
        'riot-pink': '#F047A4',
        'muted-ink': '#777A76',
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        danger: { DEFAULT: 'hsl(var(--danger))', foreground: 'hsl(var(--danger-foreground))' },
        info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
        neutral: { DEFAULT: 'hsl(var(--neutral))', foreground: 'hsl(var(--neutral-foreground))' },
        surface: {
          canvas: 'hsl(var(--surface-canvas))',
          elevated: 'hsl(var(--surface-elevated))',
          panel: 'hsl(var(--surface-panel))',
          secondary: 'hsl(var(--surface-secondary))',
          inset: 'hsl(var(--surface-inset))',
          overlay: 'hsl(var(--surface-overlay))',
        },
        'border-strong': 'hsl(var(--border-strong))',
        'border-subtle': 'hsl(var(--border-subtle))',
        focus: 'hsl(var(--focus))',
        selected: 'hsl(var(--selected))',
        disabled: 'hsl(var(--disabled))',
        hover: 'hsl(var(--hover))',
        pressed: 'hsl(var(--pressed))',
        scrim: 'hsl(var(--surface-scrim))',
        // shadcn/ui CSS variable tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      zIndex: {
        base: 'var(--z-base)',
        sticky: 'var(--z-sticky)',
        dropdown: 'var(--z-dropdown)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
        command: 'var(--z-command)',
      },
      transitionDuration: {
        fast: 'var(--motion-duration-fast)',
        standard: 'var(--motion-duration-standard)',
        slow: 'var(--motion-duration-slow)',
      },
      transitionTimingFunction: {
        riot: 'var(--motion-easing-standard)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        ui: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
