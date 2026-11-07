import * as React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from './inputs'
import { Button } from './button'
import { cn } from '../lib/utils'
export interface FilterBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>,'onChange'>{query:string;onQueryChange:(value:string)=>void;queryPlaceholder?:string;filters?:React.ReactNode;activeCount?:number;onClear?:()=>void}
export function FilterBar({query,onQueryChange,queryPlaceholder='Search records…',filters,activeCount=0,onClear,className,...props}:FilterBarProps){return <div className={cn('flex flex-col gap-2 rounded-sm border bg-surface-panel p-3 sm:flex-row sm:items-center',className)} {...props}><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Search records" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder={queryPlaceholder} className="pl-9"/></div>{filters?<div className="flex flex-wrap items-center gap-2">{filters}</div>:null}{onClear&&(query.length>0||activeCount>0)?<Button size="sm" variant="ghost" onClick={onClear}><X className="mr-1.5 h-3.5 w-3.5"/>Clear{activeCount>0?` (${activeCount})`:''}</Button>:null}</div>}
