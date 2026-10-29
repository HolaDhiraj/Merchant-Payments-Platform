import { AsyncLocalStorage } from 'async_hooks';

// Per-request data that must flow through async calls without being passed as arguments
// (e.g. the correlation id written into logs and audit entries).
export interface RequestContextData {
  readonly correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run<T>(data: RequestContextData, callback: () => T): T {
    return storage.run(data, callback);
  },

  correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
};
