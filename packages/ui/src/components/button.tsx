import * as React from 'react'
import { Slot, Slottable } from '@radix-ui/react-slot'
import { LoaderCircle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 font-display uppercase tracking-wider',
        destructive: 'bg-danger text-danger-foreground hover:bg-danger/90',
        outline: 'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent/10 hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        riot: 'bg-riot-orange text-white hover:bg-riot-orange/90 font-display uppercase tracking-wider',
        electric: 'bg-electric-blue text-obsidian hover:bg-electric-blue/90 font-display uppercase tracking-wider',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; loading?: boolean }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild=false, loading=false, disabled, children, ...props }, ref) => {
 const Comp = asChild ? Slot : 'button'
 return <Comp className={cn(buttonVariants({variant,size,className}))} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"/> : null}{asChild ? <Slottable>{children}</Slottable> : children}</Comp>
})
Button.displayName='Button'
export { Button, buttonVariants }
