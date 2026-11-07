import * as React from 'react'
import { cn } from '../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'lime' | 'orange' | 'electric' | 'pink'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'border-border text-foreground',
    lime: 'border-transparent bg-acid-lime text-obsidian',
    orange: 'border-transparent bg-riot-orange text-white',
    electric: 'border-transparent bg-electric-blue text-obsidian',
    pink: 'border-transparent bg-riot-pink text-white',
  }
  return (
    <div
      className={cn(
        'inline-flex items-center border px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
