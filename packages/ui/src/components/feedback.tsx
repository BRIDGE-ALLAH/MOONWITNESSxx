import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { LoaderCircle } from 'lucide-react'
import { cva,type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
const alertVariants=cva('relative w-full rounded-sm border p-4 text-foreground', {variants:{variant:{default:'border-border bg-surface-panel',info:'border-info/40 bg-info/10',success:'border-success/40 bg-success/10',warning:'border-warning/40 bg-warning/10',destructive:'border-danger/40 bg-danger/10'}},defaultVariants:{variant:'default'}})
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>,VariantProps<typeof alertVariants>{}
export const Alert=React.forwardRef<HTMLDivElement,AlertProps>(({className,variant,...props},ref)=><div ref={ref} role="status" className={cn(alertVariants({variant}),className)} {...props}/>)
Alert.displayName='Alert'
export const AlertTitle=({className,...props}:React.HTMLAttributes<HTMLHeadingElement>)=><h5 className={cn('mb-1 font-semibold leading-none',className)} {...props}/>
export const AlertDescription=({className,...props}:React.HTMLAttributes<HTMLParagraphElement>)=><p className={cn('text-sm text-muted-foreground',className)} {...props}/>
export const Progress=React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>,React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>>(({className,value=0,...props},ref)=>{const safe=value===null?0:Math.min(100,Math.max(0,value));return <ProgressPrimitive.Root ref={ref} value={safe} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary',className)} {...props}><ProgressPrimitive.Indicator className="h-full w-full bg-primary transition-transform" style={{transform:`translateX(-${100-safe}%)`}}/></ProgressPrimitive.Root>})
Progress.displayName='Progress'
export function Skeleton({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div aria-hidden="true" className={cn('animate-pulse rounded-sm bg-muted motion-reduce:animate-none',className)} {...props}/>}
interface AvatarState{loaded:boolean;setLoaded:(value:boolean)=>void}
const AvatarContext=React.createContext<AvatarState|undefined>(undefined)
export const Avatar=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=>{const [loaded,setLoaded]=React.useState(false);return <AvatarContext.Provider value={{loaded,setLoaded}}><div ref={ref} className={cn('relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted',className)} {...props}/></AvatarContext.Provider>})
Avatar.displayName='Avatar'
export const AvatarImage=React.forwardRef<HTMLImageElement,React.ImgHTMLAttributes<HTMLImageElement>>(({className,onLoad,onError,...props},ref)=>{const state=React.useContext(AvatarContext);return <img ref={ref} className={cn('aspect-square h-full w-full object-cover',className)} onLoad={e=>{state?.setLoaded(true);onLoad?.(e)}} onError={e=>{state?.setLoaded(false);onError?.(e)}} {...props}/>})
AvatarImage.displayName='AvatarImage'
export const AvatarFallback=({className,...props}:React.HTMLAttributes<HTMLDivElement>)=>{const state=React.useContext(AvatarContext);if(state?.loaded)return null;return <div className={cn('flex h-full w-full items-center justify-center bg-muted font-mono text-xs text-muted-foreground',className)} {...props}/>}
