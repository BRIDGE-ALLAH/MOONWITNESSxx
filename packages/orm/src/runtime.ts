import type {
  Environment,
  EnvironmentContext,
  EnvironmentDerivation,
  ExecutionTransaction,
  ModelCollection,
  Recordset,
  RegistrySnapshot,
} from "./index.js";

export interface RecordsetLoadRequest<TEnvironment extends Environment = Environment> {
  readonly env: TEnvironment;
  readonly modelName: string;
  readonly ids: readonly string[];
}

export type RecordsetLoader<TRecord> = (
  request: RecordsetLoadRequest,
) => Promise<readonly TRecord[]>;

export interface EnvironmentOptions {
  readonly registry: RegistrySnapshot;
  readonly principal: EnvironmentContext["principal"];
  readonly tenantId?: string;
  readonly companyId?: string;
  readonly allowedCompanyIds?: readonly string[];
  readonly locale: string;
  readonly timeZone: string;
  readonly traceId: string;
  readonly transaction?: ExecutionTransaction | null;
  readonly loadRecords: RecordsetLoader<unknown>;
}

class LazyRecordset<TRecord> implements Recordset<TRecord> {
  readonly modelName: string;
  readonly length: number;
  readonly ids: readonly string[];
  readonly env: Environment;
  readonly #loader: RecordsetLoader<TRecord>;
  #loaded: Promise<readonly TRecord[]> | null = null;

  constructor(
    env: Environment,
    modelName: string,
    ids: readonly string[],
    loader: RecordsetLoader<TRecord>,
  ) {
    this.env = env;
    this.modelName = modelName;
    this.ids = Object.freeze([...ids]);
    this.length = ids.length;
    this.#loader = loader;
    Object.freeze(this.ids);
  }

  #assertUsable(): void {
    if (this.env.transaction && !this.env.transaction.isActive) {
      throw new Error("Recordset transaction is no longer active.");
    }
  }

  async toArray(): Promise<readonly TRecord[]> {
    this.#assertUsable();
    if (this.length === 0) return Object.freeze([]);
    if (!this.#loaded) {
      this.#loaded = this.#loader({
        env: this.env,
        modelName: this.modelName,
        ids: this.ids,
      }).then((records) => {
        if (records.length !== this.ids.length) {
          throw new Error(`Recordset loader returned ${records.length} rows for ${this.ids.length} identities.`);
        }
        return Object.freeze([...records]);
      }).catch((error: unknown) => {
        this.#loaded = null;
        throw error;
      });
    }
    return this.#loaded;
  }

  async first(): Promise<TRecord | null> {
    this.#assertUsable();
    if (this.length === 0) return null;
    return (await this.toArray())[0] ?? null;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<TRecord> {
    for (const record of await this.toArray()) yield record;
  }
}

function freezeContext(context: EnvironmentContext): EnvironmentContext {
  const principal = context.principal ? Object.freeze({ ...context.principal }) : null;
  const allowedCompanyIds = Object.freeze([...(context.allowedCompanyIds ?? [])]);
  return Object.freeze({
    ...context,
    principal,
    allowedCompanyIds,
  });
}

function assertContext(context: EnvironmentContext): void {
  if (!context.locale.trim() || !context.timeZone.trim() || !context.traceId.trim()) {
    throw new TypeError("Environment requires locale, timeZone and traceId.");
  }
  if (context.companyId !== undefined && !context.companyId.trim()) {
    throw new TypeError("Environment companyId cannot be empty.");
  }
  if (context.companyId && !context.allowedCompanyIds?.includes(context.companyId)) {
    throw new TypeError("Environment company is outside the allowed-company scope.");
  }
  if (context.tenantId !== undefined && !context.tenantId.trim()) {
    throw new TypeError("Environment tenantId cannot be empty.");
  }
}

export function createEnvironment(options: EnvironmentOptions): Environment {
  const context = freezeContext({
    principal: options.principal,
    ...(options.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
    ...(options.companyId !== undefined ? { companyId: options.companyId } : {}),
    allowedCompanyIds: options.allowedCompanyIds ?? [],
    locale: options.locale,
    timeZone: options.timeZone,
    traceId: options.traceId,
  });
  assertContext(context);
  let environment: Environment;
  const load = options.loadRecords as RecordsetLoader<unknown>;
  const models: ModelCollection = Object.freeze({
    get<TRecord = unknown>(modelName: string, ids: readonly string[] = []): Recordset<TRecord> {
      if (!environment.registry.models[modelName]) {
        throw new TypeError(`Unknown model "${modelName}" in registry ${environment.registry.fingerprint}.`);
      }
      if (ids.some((id) => typeof id !== "string" || !id.trim())) {
        throw new TypeError("Recordset identities must be non-empty strings.");
      }
      if (new Set(ids).size !== ids.length) throw new TypeError("Recordset identities must be unique.");
      return new LazyRecordset<TRecord>(
        environment,
        modelName,
        ids,
        load as RecordsetLoader<TRecord>,
      );
    },
  });
  const derive = (changes: EnvironmentDerivation = {}): Environment => {
    if (changes.principal !== undefined || changes.tenantId !== undefined || changes.allowedCompanyIds !== undefined) {
      throw new TypeError("Principal, tenant and allowed-company scope cannot be escalated through environment derivation.");
    }
    if (changes.companyId !== undefined && !changes.companyId.trim()) {
      throw new TypeError("Derived companyId cannot be empty.");
    }
    const companyId = changes.companyId ?? context.companyId;
    if (companyId && !context.allowedCompanyIds?.includes(companyId)) {
      throw new TypeError("Cannot derive an environment for a company outside the allowed-company scope.");
    }
    return createEnvironment({
      registry: environment.registry,
      principal: context.principal,
      ...(context.tenantId ? { tenantId: context.tenantId } : {}),
      ...(companyId ? { companyId } : {}),
      allowedCompanyIds: context.allowedCompanyIds,
      locale: changes.locale ?? context.locale,
      timeZone: changes.timeZone ?? context.timeZone,
      traceId: context.traceId,
      transaction: options.transaction ?? null,
      loadRecords: load,
    });
  };
  environment = Object.freeze({
    context,
    registry: options.registry,
    models,
    transaction: options.transaction ?? null,
    derive,
  });
  return environment;
}
