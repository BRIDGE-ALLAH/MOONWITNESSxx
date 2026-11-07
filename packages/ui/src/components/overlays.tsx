import * as React from 'react'
import * as D from '@radix-ui/react-dialog'
import * as P from '@radix-ui/react-popover'
import * as T from '@radix-ui/react-tooltip'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

export const Dialog=D.Root
export const DialogTrigger=D.Trigger
export const DialogClose=D.Close
export const DialogPortal=D.Portal
export const DialogOverlay=React.forwardRef<React.ElementRef<typeof D.Overlay>,React.ComponentPropsWithoutRef<typeof D.Overlay>>(({className,...props},ref)=><D.Overlay ref={ref} className={cn('fixed inset-0 z-[var(--z-overlay)] bg-scrim/70 data-[state=open]:animate-in data-[state=closed]:animate-out',className)} {...props}/>)
DialogOverlay.displayName='DialogOverlay'
export const DialogContent=React.forwardRef<React.ElementRef<typeof D.Content>,React.ComponentPropsWithoutRef<typeof D.Content>>(({className,children,...props},ref)=><D.Portal><DialogOverlay/><D.Content ref={ref} className={cn('fixed left-1/2 top-1/2 z-[var(--z-modal)] grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-sm border bg-surface-overlay p-6 text-foreground shadow-xl',className)} {...props}>{children}<D.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X className="h-4 w-4"/><span className="sr-only">Close</span></D.Close></D.Content></D.Portal>)
DialogContent.displayName='DialogContent'
export const DialogHeader=({className,...props}:React.HTMLAttributes<HTMLDivElement>)=><div className={cn('flex flex-col gap-1.5 text-left',className)} {...props}/>
export const DialogFooter=({className,...props}:React.HTMLAttributes<HTMLDivElement>)=><div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',className)} {...props}/>
export const DialogTitle=React.forwardRef<React.ElementRef<typeof D.Title>,React.ComponentPropsWithoutRef<typeof D.Title>>(({className,...props},ref)=><D.Title ref={ref} className={cn('text-lg font-semibold leading-none',className)} {...props}/>)
DialogTitle.displayName='DialogTitle'
export const DialogDescription=React.forwardRef<React.ElementRef<typeof D.Description>,React.ComponentPropsWithoutRef<typeof D.Description>>(({className,...props},ref)=><D.Description ref={ref} className={cn('text-sm text-muted-foreground',className)} {...props}/>)
DialogDescription.displayName='DialogDescription'

export const Popover=P.Root
export const PopoverTrigger=P.Trigger
export const PopoverAnchor=P.Anchor
export const PopoverContent=React.forwardRef<React.ElementRef<typeof P.Content>,React.ComponentPropsWithoutRef<typeof P.Content>>(({className,align='center',sideOffset=6,...props},ref)=><P.Portal><P.Content ref={ref} align={align} sideOffset={sideOffset} className={cn('z-[var(--z-dropdown)] w-72 rounded-sm border bg-popover p-4 text-popover-foreground shadow-md outline-none',className)} {...props}/></P.Portal>)
PopoverContent.displayName='PopoverContent'

export const TooltipProvider=T.Provider
export const Tooltip=T.Root
export const TooltipTrigger=T.Trigger
export const TooltipContent=React.forwardRef<React.ElementRef<typeof T.Content>,React.ComponentPropsWithoutRef<typeof T.Content>>(({className,sideOffset=5,...props},ref)=><T.Portal><T.Content ref={ref} sideOffset={sideOffset} className={cn('z-[var(--z-tooltip)] rounded-sm bg-foreground px-3 py-1.5 text-xs text-background shadow-md',className)} {...props}><T.Arrow className="fill-foreground"/></T.Content></T.Portal>)
TooltipContent.displayName='TooltipContent'
