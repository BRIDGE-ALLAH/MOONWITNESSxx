import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Label } from '@radix-ui/react-label'
import { Check } from 'lucide-react'
import { cn } from '../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type='text', invalid=false, ...props }, ref) => <input ref={ref} type={type} aria-invalid={invalid || props['aria-invalid'] || undefined} className={cn('flex h-10 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60', invalid && 'border-danger focus-visible:ring-danger', className)} {...props} />)
Input.displayName='Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean; showCount?: boolean }
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid=false, showCount=false, maxLength, value, defaultValue, onChange, ...props }, ref) => {
 const [draft,setDraft]=React.useState(String(defaultValue ?? '')); const current=value !== undefined ? String(value) : draft
 return <div className="grid gap-1.5"><textarea ref={ref} maxLength={maxLength} value={value} defaultValue={defaultValue} onChange={e=>{if(value===undefined)setDraft(e.target.value);onChange?.(e)}} aria-invalid={invalid || props['aria-invalid'] || undefined} className={cn('min-h-24 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60',invalid&&'border-danger focus-visible:ring-danger',className)} {...props}/>{showCount&&maxLength!==undefined?<span className="text-right text-xs text-muted-foreground tabular-nums">{current.length}/{maxLength}</span>:null}</div>
})
Textarea.displayName='Textarea'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> { label?: React.ReactNode; description?: React.ReactNode }
export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>,CheckboxProps>(({className,label,description,id,...props},ref)=>{
 const generated=React.useId();const controlId=id??generated
 return <div className="flex items-start gap-2.5"><CheckboxPrimitive.Root ref={ref} id={controlId} className={cn('peer mt-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-input bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',className)} {...props}><CheckboxPrimitive.Indicator className="flex items-center justify-center"><Check className="h-3.5 w-3.5"/></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>{label||description?<div className="grid gap-0.5"><label htmlFor={controlId} className="cursor-pointer text-sm font-medium peer-disabled:opacity-60">{label}</label>{description?<p className="text-xs text-muted-foreground">{description}</p>:null}</div>:null}</div>
})
Checkbox.displayName='Checkbox'

export const RadioGroup=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} role="radiogroup" className={cn('grid gap-3',className)} {...props}/>)
RadioGroup.displayName='RadioGroup'
export interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,'type'>{}
export const RadioGroupItem=React.forwardRef<HTMLInputElement,RadioGroupItemProps>(({className,...props},ref)=><input ref={ref} type="radio" className={cn('h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50',className)} {...props}/>)
RadioGroupItem.displayName='RadioGroupItem'

export const Switch=React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>,React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({className,...props},ref)=><SwitchPrimitive.Root ref={ref} className={cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 data-[state=checked]:bg-primary',className)} {...props}><SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"/></SwitchPrimitive.Root>)
Switch.displayName='Switch'

export interface FormFieldControlProps { id:string; 'aria-describedby'?:string; 'aria-invalid'?:boolean }
export interface FormFieldProps { label:React.ReactNode; description?:React.ReactNode; error?:React.ReactNode; required?:boolean; disabled?:boolean; id?:string; className?:string; children:(control:FormFieldControlProps)=>React.ReactNode }
export function FormField({label,description,error,required,disabled,id,className,children}:FormFieldProps){
 const generated=React.useId();const controlId=id??generated;const descriptionId=description?`${controlId}-description`:undefined;const errorId=error?`${controlId}-error`:undefined
 return <div className={cn('grid gap-1.5',className)}><Label htmlFor={controlId} className={cn('text-sm font-medium leading-none',disabled&&'opacity-60')}>{label}{required?<span className="ml-1 text-danger" aria-hidden="true">*</span>:null}</Label>{children({id:controlId,'aria-describedby':[descriptionId,errorId].filter(Boolean).join(' ')||undefined,'aria-invalid':Boolean(error)||undefined})}{description?<p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>:null}{error?<p id={errorId} className="text-xs font-medium text-danger" role="alert">{error}</p>:null}</div>
}
