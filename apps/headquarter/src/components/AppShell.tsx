'use client'
import Link from 'next/link'
import { usePathname,useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect,useMemo,useState } from 'react'
import { Badge,Button,cn,RiotAppShell,RiotSidebar,RiotTopbar,RiotCommandPalette } from '@riotworks/ui'
import type { RiotCommand } from '@riotworks/ui'
type NavItem={href:string;label:string;group:string}
const NAV:NavItem[]=[
 {href:'/arsy-deck',label:'ARSY DECK',group:'Core'},{href:'/signal-room',label:'SIGNAL ROOM',group:'Core'},{href:'/riot-radar',label:'RIOT RADAR',group:'Core'},{href:'/the-forge',label:'THE FORGE',group:'Core'},{href:'/zill-watch',label:'ZILL WATCH',group:'Core'},
 {href:'/launch-bay',label:'LAUNCH BAY',group:'Operations'},{href:'/sidra-archive',label:'SIDRA ARCHIVE',group:'Operations'},{href:'/mizan-ledger',label:'MIZAN LEDGER',group:'Operations'},{href:'/aftershock',label:'AFTERSHOCK',group:'Operations'},{href:'/riot-engine',label:'RIOT ENGINE',group:'Operations'},{href:'/settings-policy',label:'SETTINGS / POLICY',group:'System'},
]
const STRINGS={en:{search:'Search commands',workspace:'Workspace: Demo',notifications:'Notifications',locale:'EN',theme:'Theme',profile:'Operator',demo:'Prototype // Demo Data Only'},id:{search:'Cari perintah',workspace:'Ruang Kerja: Demo',notifications:'Notifikasi',locale:'ID',theme:'Tema',profile:'Operator',demo:'Prototipe // Data Demo Saja'}}
export function AppShell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter(),{resolvedTheme,setTheme}=useTheme()
 const [mounted,setMounted]=useState(false),[locale,setLocale]=useState<'en'|'id'>('en'),[paletteOpen,setPaletteOpen]=useState(false),[collapsed,setCollapsed]=useState(false),[notice,setNotice]=useState<string|null>(null)
 useEffect(()=>setMounted(true),[])
 const t=STRINGS[locale],groups=useMemo(()=>Array.from(new Set(NAV.map(n=>n.group))),[])
 const notify=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(null),2200)}
 const commands:RiotCommand[]=NAV.map(n=>({id:n.href,label:n.label,group:n.group,keywords:[n.href],onSelect:()=>router.push(n.href)}))
 const dark=mounted?resolvedTheme==='dark':true
 const sidebar=<RiotSidebar collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)} brand={<Link href="/" className="block min-w-0 border-2 border-acid-lime/40 p-3"><span className="block truncate font-display text-xl uppercase leading-none">MOONWITNESS</span>{!collapsed?<span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">// RIOTWORKS</span>:null}</Link>} footer={!collapsed?<Badge variant="lime">{t.demo}</Badge>:<Badge variant="lime">MW</Badge>}>
  <div className="grid gap-5">{groups.map(group=><section key={group}><h2 className={cn('mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground',collapsed&&'sr-only')}>{group}</h2><div className="grid gap-1">{NAV.filter(n=>n.group===group).map(n=><Link key={n.href} href={n.href} aria-current={pathname===n.href?'page':undefined} title={collapsed?n.label:undefined} className={cn('block border px-3 py-2 font-mono text-xs uppercase tracking-wide',pathname===n.href?'border-acid-lime bg-acid-lime/10 text-acid-lime':'border-transparent hover:border-acid-lime/30',collapsed&&'truncate px-1 text-center')}>{collapsed?n.label.slice(0,2):n.label}</Link>)}</div></section>)}</div>
 </RiotSidebar>
 const topbar=<RiotTopbar className="border-acid-lime/20"><Button variant="outline" size="sm" onClick={()=>setPaletteOpen(true)}>{t.search} <kbd className="ml-2 text-[10px] opacity-70">⌘K</kbd></Button><span className="font-mono text-[11px] uppercase text-muted-foreground">{t.workspace}</span><div className="ml-auto flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={()=>notify(t.notifications)}>{t.notifications}</Button><Button variant="electric" size="sm" onClick={()=>setLocale(l=>l==='en'?'id':'en')}>{t.locale}</Button><Button variant="riot" size="sm" onClick={()=>setTheme(dark?'light':'dark')}>{t.theme}</Button><Badge variant="outline">{t.profile}</Badge></div></RiotTopbar>
 return <RiotAppShell sidebar={sidebar} sidebarCollapsed={collapsed} topbar={topbar} statusBar={<div className="flex items-center justify-between px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><span>MOONWITNESS // RIOTWORKS</span><span>{notice??'Prototype // Demo data only'}</span></div>}><div>{children}</div><RiotCommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen}/><div className="sr-only" aria-live="polite">{notice}</div></RiotAppShell>
}
