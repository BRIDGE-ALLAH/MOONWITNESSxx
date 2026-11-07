import * as ui from '@riotworks/ui'
const requiredExports = ['Button','buttonVariants','IconButton','Input','Textarea','Checkbox','CheckboxGroup','RadioGroup','RadioGroupItem','Switch','Select','SelectTrigger','SelectContent','SelectItem','Dialog','DialogContent','DialogTitle','Popover','PopoverContent','Tooltip','TooltipContent','Tabs','TabsList','TabsTrigger','Breadcrumb','Pagination','Alert','Progress','Spinner','Skeleton','Avatar','Card','CardHeader','CardTitle','CardDescription','CardContent','Badge','Separator','FormField','DataTable','FilterBar','BulkActions','EmptyState','ErrorState','MetricCard','ActivityTimeline','cn']
const missingExports=requiredExports.filter(name=>!(name in ui))
if(missingExports.length) throw new Error(`Missing @riotworks/ui exports: ${missingExports.join(', ')}`)
console.log(`@riotworks/ui consumer smoke test passed (${requiredExports.length} exports).`)
