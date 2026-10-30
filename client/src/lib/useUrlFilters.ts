import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// List filters live in the URL, so a filtered view can be bookmarked, shared and survives refresh.
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (next: Record<string, string | undefined>) => {
      setParams(
        (current) => {
          const merged = new URLSearchParams(current);
          for (const [key, value] of Object.entries(next)) {
            if (value) merged.set(key, value);
            else merged.delete(key);
          }
          return merged;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const page = Math.max(1, Number(params.get('page')) || 1);
  return { params, page, update };
}
