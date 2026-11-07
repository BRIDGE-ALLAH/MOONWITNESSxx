import * as React from 'react'
import { cn } from '../lib/utils'
export interface CheckboxGroupProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> { legend?: React.ReactNode; description?: React.ReactNode }
export function CheckboxGroup({legend,description,className,children,...props}:CheckboxGroupProps){const id=React.useId();return <fieldset className={cn('grid gap-3',className)} {...props}>{legend?<legend className="mb-1 text-sm font-semibold">{legend}</legend>:null}{description?<p id={id} className="text-xs text-muted-foreground">{description}</p>:null}<div className="grid gap-3" aria-describedby={description?id:undefined}>{children}</div></fieldset>}
