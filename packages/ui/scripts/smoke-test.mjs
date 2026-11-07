import ui from '@riotworks/ui'

const requiredExports = ['Button', 'buttonVariants', 'Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'Badge', 'Separator', 'cn']
const missingExports = requiredExports.filter((name) => !(name in ui))

if (missingExports.length > 0) {
  throw new Error(`Missing @riotworks/ui exports: ${missingExports.join(', ')}`)
}

console.log(`@riotworks/ui consumer smoke test passed (${requiredExports.length} exports).`)
