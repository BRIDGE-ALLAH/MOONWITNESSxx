import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '../lib/utils'
export interface BulkActionsProps extends React.HTMLAttributes<HTMLDivElement>{selectedCount:number;onClearSelection?:()=>void;children:React.ReactNode}
export function BulkActions({selectedCount,onClearSelection,children,className,...props}:BulkActionsProps){if(selectedCount<=0)return null;return <div role="toolbar" aria-label="Bulk actions" className={cn('flex flex-wrap items-center gap-2 rounded-sm border border-primary/30 bg-selected p-2',className)} {...props}><span className="mr-1 text-sm font-semibold tabular-nums">{selectedCount} selected</span><div className="flex flex-wrap items-center gap-2">{children}</div>{onClearSelection?<Button size="sm" variant="ghost" className="ml-auto" onClick={onClearSelection}><X className="mr-1 h-3.5 w-3.5"/>Clear selection</Button>:null}</div>}
