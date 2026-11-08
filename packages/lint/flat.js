const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
})

const config = compat.config(require('./index.js'))

module.exports = config.map((entry) =>
  entry.files ? entry : { ...entry, files: ['**/*.{ts,tsx,js,mjs,cjs}'] }
)
