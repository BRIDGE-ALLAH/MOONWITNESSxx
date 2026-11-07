'use client'
import * as React from 'react'
import { Search, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { Button } from './button'
import { Input } from './inputs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './overlays'
import { cn } from '../lib/utils'

export interface RiotAppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar?: React.ReactNode
  topbar?: React.ReactNode
  contextPanel?: React.ReactNode
  statusBar?: React.ReactNode
  sidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
}
export function RiotAppShell({sidebar,topbar,contextPanel,statusBar,sidebarCollapsed,onSidebarCollapsedChange,children,className,...props}:RiotAppShellProps){
 const [localCollapsed,setLocalCollapsed]=React.useState(false)
 const collapsed=sidebarCollapsed??localCollapsed
 const setCollapsed=(v:boolean)=>{if(sidebarCollapsed===undefined)setLocalCollapsed(v);onSidebarCollapsedChange?.(v)}
 const [mobileOpen,setMobileOpen]=React.useState(false)
 return <div className={cn('flex min-h-screen min-w-0 flex-col bg-background text-foreground',className)} {...props}>
  <div className="flex min-h-0 flex-1">
   {sidebar?<><aside className={cn('hidden shrink-0 border-r bg-surface-panel transition-[width] duration-200 md:block',collapsed?'w-16':'w-64')} aria-label="Primary sidebar">{sidebar}</aside><Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogContent className="left-0 top-0 h-dvh w-[min(20rem,88vw)] max-w-none translate-x-0 translate-y-0 rounded-none p-0"><DialogHeader className="sr-only"><DialogTitle>Navigation</DialogTitle><DialogDescription>Primary application navigation</DialogDescription></DialogHeader><div className="h-full overflow-y-auto">{sidebar}</div></DialogContent><Button className="fixed bottom-4 left-4 z-40 md:hidden" size="icon" variant="riot" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><PanelLeftOpen className="h-4 w-4"/></Button></Dialog></>:null}
   <div className="flex min-w-0 flex-1 flex-col">
    {topbar?<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">{topbar}</header>:null}
    <div className="flex min-h-0 min-w-0 flex-1">
     <main className="min-w-0 flex-1">{children}</main>
     {contextPanel?<aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-surface-panel xl:block" aria-label="Context panel">{contextPanel}</aside>:null}
    </div>
   </div>
  </div>
  {statusBar?<footer className="border-t bg-surface-panel">{statusBar}</footer>:null}
 </div>
}
export interface RiotSidebarProps extends React.HTMLAttributes<HTMLElement>{brand?:React.ReactNode;children?:React.ReactNode;footer?:React.ReactNode;collapsed?:boolean;onToggle?:()=>void}
export function RiotSidebar({brand,children,footer,collapsed=false,onToggle,className,...props}:RiotSidebarProps){return <nav className={cn('flex h-full min-h-0 flex-col gap-4 p-3',className)} {...props}><div className="flex items-center justify-between gap-2">{brand}{onToggle?<Button size="icon" variant="ghost" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={onToggle}>{collapsed?<PanelLeftOpen className="h-4 w-4"/>:<PanelLeftClose className="h-4 w-4"/>}</Button>:null}</div><div className="min-h-0 flex-1 overflow-y-auto">{children}</div>{footer?<div className="border-t pt-3">{footer}</div>:null}</nav>}
export function RiotTopbar({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('flex min-h-14 flex-wrap items-center gap-3 px-4 py-2',className)} {...props}/>}
export function RiotWorkspace({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8',className)} {...props}/>}
export function RiotContextPanel({title,description,className,children,...props}:React.HTMLAttributes<HTMLElement>&{title?:React.ReactNode;description?:React.ReactNode}){return <section className={cn('grid content-start gap-4 p-4',className)} {...props}>{title?<header className="grid gap-1"><h2 className="font-display text-sm uppercase tracking-wide">{title}</h2>{description?<p className="text-xs text-muted-foreground">{description}</p>:null}</header>:null}{children}</section>}
export interface RiotCommand {id:string;label:string;description?:string;group?:string;keywords?:string[];shortcut?:string;disabled?:boolean;onSelect:()=>void}
export interface RiotCommandPaletteProps {commands:RiotCommand[];open?:boolean;onOpenChange?:(open:boolean)=>void;placeholder?:string;emptyLabel?:string}
export function RiotCommandPalette({commands,open,onOpenChange,placeholder='Search commands…',emptyLabel='No matching commands'}:RiotCommandPaletteProps){
 const [localOpen,setLocalOpen]=React.useState(false),[query,setQuery]=React.useState('')
 const controlled=open!==undefined,shown=controlled?open:localOpen
 const setOpen=(v:boolean)=>{if(!controlled)setLocalOpen(v);onOpenChange?.(v);if(!v)setQuery('')}
 React.useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(!shown)}if(e.key==='Escape'&&shown)setOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[shown])
 const filtered=commands.filter(c=>!c.disabled&&[c.label,c.description??'',c.group??'',...(c.keywords??[])].join(' ').toLowerCase().includes(query.toLowerCase()))
 return <Dialog open={shown} onOpenChange={setOpen}><DialogContent className="top-[18vh] max-w-xl translate-y-0"><DialogHeader><DialogTitle>Command palette</DialogTitle><DialogDescription>Search and run an application command. Privileged actions must be authorized by the host application.</DialogDescription></DialogHeader><Input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder} aria-label="Search commands"/><div className="max-h-80 overflow-y-auto" role="listbox">{filtered.map(c=><button key={c.id} type="button" role="option" aria-selected="false" className="flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={()=>{setOpen(false);c.onSelect()}}><span className="min-w-0"><span className="block text-sm font-medium">{c.label}</span>{c.description?<span className="block text-xs text-muted-foreground">{c.description}</span>:null}</span>{c.shortcut?<kbd className="shrink-0 rounded border px-1.5 py-0.5 text-xs">{c.shortcut}</kbd>:null}</button>)}{filtered.length===0?<p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>:null}</div></DialogContent></Dialog>
}
export function RiotNotificationCenter({trigger,children}:{trigger:React.ReactNode;children:React.ReactNode}){return <div className="relative">{trigger}<div className="sr-only" aria-live="polite">{children}</div>{children}</div>}
