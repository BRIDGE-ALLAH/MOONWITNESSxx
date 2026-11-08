import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next 16 pulls eslint-plugin-react-hooks v7, whose recommended set
    // added set-state-in-effect. That rule was absent from the prior 15.1 rule set, so
    // keep it off to preserve the repository's existing lint behavior after the v10 migration.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]
