import type { DatabaseAdapter, DatabaseTransaction } from "@riotworks/orm-db-adaptor";
import type { UnitOfWork, UnitOfWorkFactory } from "./index.js";

type UnitOfWorkState = "active" | "committed" | "rolled-back" | "failed";

class AdapterUnitOfWork implements UnitOfWork {
  readonly transaction: DatabaseTransaction;
  #state: UnitOfWorkState = "active";

  constructor(transaction: DatabaseTransaction) {
    this.transaction = transaction;
  }

  get isActive(): boolean {
    return this.#state === "active" && this.transaction.isActive;
  }

  async commit(): Promise<void> {
    this.#assertActive();
    try {
      await this.transaction.commit();
      this.#state = "committed";
    } catch (error) {
      this.#state = "failed";
      throw error;
    }
  }

  async rollback(): Promise<void> {
    if (this.#state !== "active") return;
    if (!this.transaction.isActive) {
      this.#state = "failed";
      return;
    }
    try {
      await this.transaction.rollback();
      this.#state = "rolled-back";
    } catch (error) {
      this.#state = "failed";
      throw error;
    }
  }

  #assertActive(): void {
    if (!this.isActive) throw new Error(`UnitOfWork cannot be used in state "${this.#state}".`);
  }
}

export function createUnitOfWorkFactory(adapter: DatabaseAdapter): UnitOfWorkFactory {
  return Object.freeze({
    async begin(options?: Readonly<{ isolationLevel?: string; readOnly?: boolean }>): Promise<UnitOfWork> {
      const transaction = await adapter.beginTransaction(options);
      if (!transaction.isActive) {
        await transaction.rollback().catch(() => undefined);
        throw new Error("Database adapter returned an inactive transaction.");
      }
      return new AdapterUnitOfWork(transaction);
    },
  });
}

export async function withUnitOfWork<T>(
  factory: UnitOfWorkFactory,
  operation: (unitOfWork: UnitOfWork) => Promise<T>,
  options?: Readonly<{ isolationLevel?: string; readOnly?: boolean }>,
): Promise<T> {
  const unitOfWork = await factory.begin(options);
  try {
    const result = await operation(unitOfWork);
    await unitOfWork.commit();
    return result;
  } catch (error) {
    try {
      await unitOfWork.rollback();
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "UnitOfWork failed and rollback also failed.");
    }
    throw error;
  }
}
