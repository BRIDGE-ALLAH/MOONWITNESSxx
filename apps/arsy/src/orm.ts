import {
  composeRegistry,
  type EnvironmentContext,
  type RegistryBuildInput,
} from "@riotworks/orm";
import { baseAddon } from "@riotworks/orm-addon-base";
import {
  createOrmRuntime,
  DatabaseAuditWriter,
  SchemaReconciler,
  DatabaseSchemaLedger,
  type AccessControl,
  type OrmRuntime,
} from "@riotworks/orm-db";
import { createLibsqlAdapter, type LibsqlAdapterOptions } from "@riotworks/orm-db-adaptor-libsql";
import { createPostgresAdapter } from "@riotworks/orm-db-adaptor-postgres";
import type { DatabaseAdapter } from "@riotworks/orm-db-adaptor";

export interface ArsyPersistenceOptions {
  readonly businessDatabaseUrl: string;
  readonly systemDatabase: LibsqlAdapterOptions;
  readonly context: EnvironmentContext;
  readonly access: AccessControl;
  readonly addons?: Omit<RegistryBuildInput, "addons" | "modules" | "models" | "mixins"> & Partial<Pick<RegistryBuildInput, "addons" | "modules" | "models" | "mixins">>;
  readonly allowSingleWriterLibsqlSchema?: boolean;
}

export interface ArsyPersistence {
  readonly registry: ReturnType<typeof composeRegistry>;
  readonly orm: OrmRuntime;
  readonly businessDatabase: DatabaseAdapter;
  readonly systemDatabase: DatabaseAdapter;
  readonly schema: SchemaReconciler;
  close(): Promise<void>;
}

export async function createArsyPersistence(options: ArsyPersistenceOptions): Promise<ArsyPersistence> {
  const extra = options.addons ?? {};
  const registry = composeRegistry({
    addons: [baseAddon.manifest, ...(extra.addons ?? [])],
    modules: [baseAddon.module, ...(extra.modules ?? [])],
    models: [...baseAddon.models, ...(extra.models ?? [])],
    mixins: [...baseAddon.mixins, ...(extra.mixins ?? [])],
    ...(extra.extensions ? { extensions: extra.extensions } : {}),
  });
  const businessDatabase = createPostgresAdapter(options.businessDatabaseUrl);
  const systemDatabase = createLibsqlAdapter(options.systemDatabase);
  try {
    await Promise.all([businessDatabase.connect(), systemDatabase.connect()]);
    const ledger = new DatabaseSchemaLedger(systemDatabase);
    await ledger.initialize();
    const orm = createOrmRuntime({
      registry,
      adapter: businessDatabase,
      context: options.context,
      access: options.access,
      audit: new DatabaseAuditWriter(),
    });
    const schema = new SchemaReconciler(businessDatabase, ledger, {
      allowSingleWriterLibsql: options.allowSingleWriterLibsqlSchema ?? false,
    });
    let closePromise: Promise<void> | undefined;
    return Object.freeze({
      registry,
      orm,
      businessDatabase,
      systemDatabase,
      schema,
      close: () => {
        closePromise ??= Promise.all([businessDatabase.close(), systemDatabase.close()]).then(() => undefined);
        return closePromise;
      },
    });
  } catch (error) {
    await Promise.allSettled([businessDatabase.close(), systemDatabase.close()]);
    throw error;
  }
}
