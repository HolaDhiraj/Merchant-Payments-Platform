// Pagination input shared by list use cases.
export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

// Pagination output: one page of items plus totals for the client.
export interface Page<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export function buildPage<T>(items: T[], totalItems: number, request: PageRequest): Page<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / request.pageSize),
  };
}

export function mapPage<T, R>(page: Page<T>, mapper: (item: T) => R): Page<R> {
  return { ...page, items: page.items.map(mapper) };
}
