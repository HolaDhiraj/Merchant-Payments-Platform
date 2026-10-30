import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { merchantBase, merchantReads } from './endpoints';

// Which merchant the portal screens show. Outside a provider it is the signed-in merchant
// user's own merchant; a platform admin's merchant workspace wraps the same screens in a
// provider naming the merchant, which makes them read-only oversight.
const MerchantScopeContext = createContext<string | null>(null);

export function MerchantScopeProvider({ merchantId, children }: { merchantId: string; children: ReactNode }) {
  return <MerchantScopeContext.Provider value={merchantId}>{children}</MerchantScopeContext.Provider>;
}

export interface MerchantScope {
  // null for the merchant user's own merchant.
  merchantId: string | null;
  // A platform admin looking at someone else's merchant: nothing can be changed.
  oversight: boolean;
  // Query-key segment, so cached data of one merchant is never shown for another.
  key: string;
  api: ReturnType<typeof merchantReads>;
  // Where a portal screen lives for this merchant, e.g. path('/payments').
  path(subPath?: string): string;
}

export function useMerchantScope(): MerchantScope {
  const merchantId = useContext(MerchantScopeContext);
  return useMemo(
    () => ({
      merchantId,
      oversight: merchantId !== null,
      key: merchantId ?? 'own',
      api: merchantReads(merchantBase(merchantId)),
      path: (subPath = '') => (merchantId ? `/merchants/${merchantId}` : '/portal') + subPath,
    }),
    [merchantId],
  );
}
