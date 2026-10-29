// Port for running several repository calls atomically. Use cases depend on this
// abstraction, while the TypeORM adapter decides how a transaction is actually opened.
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
