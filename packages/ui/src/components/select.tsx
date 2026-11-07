import * as React from 'react'
import * as P from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
export const Select=P.Root
export const SelectGroup=P.Group
export const SelectValue=P.Value
export const SelectTrigger=React.forwardRef<React.ElementRef<typeof P.Trigger>,React.ComponentPropsWithoutRef<typeof P.Trigger>>(({className,children,...props},ref)=><P.Trigger ref={ref} className={cn('flex h-10 w-full items-center justify-between rounded-sm border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 data-[placeholder]:text-muted-foreground',className)} {...props}>{children}<P.Icon asChild><ChevronDown className="h-4 w-4 opacity-60"/></P.Icon></P.Trigger>)
SelectTrigger.displayName='SelectTrigger'
export const SelectContent=React.forwardRef<React.ElementRef<typeof P.Content>,React.ComponentPropsWithoutRef<typeof P.Content>>(({className,children,position='popper',...props},ref)=><P.Portal><P.Content ref={ref} position={position} className={cn('relative z-[var(--z-dropdown)] max-h-96 min-w-[8rem] overflow-hidden rounded-sm border bg-popover text-popover-foreground shadow-md',className)} {...props}><P.ScrollUpButton className="flex justify-center py-1"><ChevronUp className="h-4 w-4"/></P.ScrollUpButton><P.Viewport className="p-1">{children}</P.Viewport><P.ScrollDownButton className="flex justify-center py-1"><ChevronDown className="h-4 w-4"/></P.ScrollDownButton></P.Content></P.Portal>)
SelectContent.displayName='SelectContent'
export const SelectItem=React.forwardRef<React.ElementRef<typeof P.Item>,React.ComponentPropsWithoutRef<typeof P.Item>>(({className,children,...props},ref)=><P.Item ref={ref} className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',className)} {...props}><span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"><P.ItemIndicator><Check className="h-4 w-4"/></P.ItemIndicator></span><P.ItemText>{children}</P.ItemText></P.Item>)
SelectItem.displayName='SelectItem'
