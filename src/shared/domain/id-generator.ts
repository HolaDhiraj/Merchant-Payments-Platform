import { randomUUID } from 'crypto';

// Abstracts identifier creation so aggregates get their id before persistence
// and tests can use predictable ids.
export interface IdGenerator {
  next(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
