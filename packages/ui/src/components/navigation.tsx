import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { cn } from '../lib/utils'
export const Tabs=TabsPrimitive.Root
export const TabsList=React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>,React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({className,...props},ref)=><TabsPrimitive.List ref={ref} className={cn('inline-flex h-10 items-center gap-1 border-b border-border',className)} {...props}/>)
TabsList.displayName='TabsList'
export const TabsTrigger=React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>,React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({className,...props},ref)=><TabsPrimitive.Trigger ref={ref} className={cn('inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=active]:border-primary data-[state=active]:text-foreground disabled:opacity-50',className)} {...props}/>)
TabsTrigger.displayName='TabsTrigger'
export const TabsContent=React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>,React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({className,...props},ref)=><TabsPrimitive.Content ref={ref} className={cn('mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',className)} {...props}/>)
TabsContent.displayName='TabsContent'
export const Breadcrumb=({...props}:React.ComponentProps<'nav'>)=><nav aria-label="breadcrumb" {...props}/>
export const BreadcrumbList=React.forwardRef<HTMLOListElement,React.ComponentProps<'ol'>>(({className,...props},ref)=><ol ref={ref} className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground',className)} {...props}/>)
BreadcrumbList.displayName='BreadcrumbList'
export const BreadcrumbItem=React.forwardRef<HTMLLIElement,React.ComponentProps<'li'>>(({className,...props},ref)=><li ref={ref} className={cn('inline-flex items-center gap-2',className)} {...props}/>)
BreadcrumbItem.displayName='BreadcrumbItem'
export const BreadcrumbLink=React.forwardRef<HTMLAnchorElement,React.ComponentProps<'a'>>(({className,...props},ref)=><a ref={ref} className={cn('hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',className)} {...props}/>)
BreadcrumbLink.displayName='BreadcrumbLink'
export const BreadcrumbPage=({className,...props}:React.ComponentProps<'span'>)=><span aria-current="page" className={cn('font-medium text-foreground',className)} {...props}/>
export interface PaginationProps { page:number; pageCount:number; onPageChange:(page:number)=>void; className?:string }
export function Pagination({page,pageCount,onPageChange,className}:PaginationProps){const total=Math.max(1,pageCount);const current=Math.min(Math.max(1,page),total);return <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3',className)}><Button size="sm" variant="outline" disabled={current<=1} onClick={()=>onPageChange(current-1)}><ChevronLeft className="mr-1 h-4 w-4"/>Previous</Button><span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">Page {current} of {total}</span><Button size="sm" variant="outline" disabled={current>=total} onClick={()=>onPageChange(current+1)}>Next<ChevronRight className="ml-1 h-4 w-4"/></Button></nav>}
