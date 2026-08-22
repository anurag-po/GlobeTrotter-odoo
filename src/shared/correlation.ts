import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
  userId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export const correlationContext = {
  run<R>(context: RequestContext, callback: () => R): R {
    return asyncLocalStorage.run(context, callback);
  },

  get(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
  },

  getCorrelationId(): string | undefined {
    return asyncLocalStorage.getStore()?.correlationId;
  },

  getUserId(): string | undefined {
    return asyncLocalStorage.getStore()?.userId;
  },
};
