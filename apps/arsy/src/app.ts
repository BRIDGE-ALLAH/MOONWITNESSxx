import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import type { Pool } from 'pg'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { createDatabasePool, setupDatabase, type DatabasePool } from './db.ts'
import { registerDockerRoutes } from './docker/routes.ts'
import { registerDeploymentRoutes } from './deployments/routes.ts'
import type { AuthorizeDeploymentDependencies } from './deployments/authorization.ts'
import { registerEvidenceRoutes } from './evidence/routes.ts'
import { registerGovernanceRoutes } from './governance/routes.ts'
import { registerLoginAttemptRoutes } from './auth/login-attempts.ts'
import { registerOpportunityRoutes } from './opportunities/routes.ts'
import { registerProductRoutes } from './products/routes.ts'
import { registerInspectionRoutes } from './inspections/routes.ts'
import { registerFinancialRoutes } from './finance/routes.ts'
import { registerPayoutAndFxRoutes } from './finance/payout-routes.ts'
import { registerPortfolioMetricsRoutes } from './analytics/routes.ts'
import { registerAssetRoutes } from './assets/routes.ts'
import type { AssetStorage } from './assets/storage.ts'
import { registerChannelRoutes } from './channels/routes.ts'
import { registerListingRoutes } from './listings/routes.ts'
import { registerOperatorApiAuth } from './auth/operator-token.ts'
import { createOracleClient, type OracleClient } from './oracle/client.ts'
import { registerOracleRoutes } from './oracle/routes.ts'

export interface CreateAppOptions {
  databasePool?: DatabasePool
  logger?: boolean
  env?: NodeJS.ProcessEnv
  oracleClient?: OracleClient
  assetStorage?: AssetStorage
  /** Optional trusted policy/capability adapters; omitted configuration fails closed. */
  deploymentAuthorization?: Omit<AuthorizeDeploymentDependencies, 'store'>
}

export function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true })
  const env = options.env ?? process.env
  const databasePool = options.databasePool ?? createDatabasePool(env)
  const oracleClient = options.oracleClient ?? createOracleClient(env)
  registerOperatorApiAuth(app, env)

  app.register(async (instance) => {
    // Register the onRoute hook before declaring routes in this encapsulated scope.
    await instance.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' })
    instance.setValidatorCompiler(validatorCompiler)

    const typedApp = instance.withTypeProvider<ZodTypeProvider>()

    // fastify-type-provider-zod@1 serializes response schemas with zod-to-json-schema@3,
    // which cannot read Zod v4 schemas. Routes return plain objects and use Fastify's
    // default JSON serialization; request validation above still uses Zod v4.
    typedApp.get('/', async () => ({
      status: 'ok',
      message: 'ARSY Command Center is running',
    }))

    typedApp.get('/health/live', async () => ({ status: 'alive' }))

    typedApp.get(
      '/health/ready',
      { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
      async (_request, reply) => {
        try {
          await databasePool.query('SELECT 1')
          return { status: 'ready' }
        } catch {
          return reply.code(503).send({ status: 'not-ready' })
        }
      }
    )

    setupDatabase(instance, databasePool)
    registerDockerRoutes(instance, databasePool, env)
    registerDeploymentRoutes(instance, databasePool, {
      authorization: options.deploymentAuthorization,
      env,
    })
    registerEvidenceRoutes(instance, databasePool as unknown as Pool)
    registerGovernanceRoutes(instance, databasePool as unknown as Pool)
    registerLoginAttemptRoutes(instance, databasePool)
    registerOpportunityRoutes(instance, databasePool, env)
    registerProductRoutes(instance, databasePool, env)
    registerInspectionRoutes(instance, databasePool, env)
    registerFinancialRoutes(instance, databasePool, env)
    registerPayoutAndFxRoutes(instance, databasePool, env)
    registerPortfolioMetricsRoutes(instance, databasePool, env)
    registerAssetRoutes(instance, databasePool, env, options.assetStorage)
    registerChannelRoutes(instance, databasePool, env)
    registerListingRoutes(instance, databasePool, env)
    registerOracleRoutes(instance, oracleClient)
  })

  return app
}
