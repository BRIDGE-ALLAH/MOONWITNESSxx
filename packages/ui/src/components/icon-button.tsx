import * as React from 'react'
import { cn } from '../lib/utils'
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { size?: 'sm' | 'default' | 'lg'; variant?: 'default' | 'outline' | 'ghost' | 'destructive'; loading?: boolean }
const sizes = { sm: 'h-8 w-8', default: 'h-10 w-10', lg: 'h-11 w-11' }
const variants = { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground', ghost: 'hover:bg-accent/10 hover:text-accent-foreground', destructive: 'bg-danger text-danger-foreground hover:bg-danger/90' }
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ className, size='default', variant='ghost', loading=false, disabled, ...props }, ref) => <button ref={ref} type={props.type ?? 'button'} className={cn('inline-flex shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', sizes[size], variants[variant], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props} />)
IconButton.displayName='IconButton'
