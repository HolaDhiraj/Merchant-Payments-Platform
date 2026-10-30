import { session } from '@/auth/session';

// Same-origin API: the NestJS server serves both this app and the API on one port,
// so there is no CORS and no environment-specific base URL.
const API_BASE = '/api';
export const LOGIN_PATH = '/auth/login';

// Error envelope produced by the API's GlobalExceptionFilter.
interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  meta?: Record<string, unknown>;
  correlationId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];
  readonly meta: Record<string, unknown>;
  readonly correlationId?: string;

  constructor(status: number, body: Partial<ErrorBody>) {
    const details = Array.isArray(body.message) ? body.message : body.message ? [body.message] : [];
    super(details[0] ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error ?? 'UNKNOWN';
    this.details = details;
    this.meta = body.meta ?? {};
    this.correlationId = body.correlationId;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  const token = session.token();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(API_BASE + path + toQueryString(options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, { message: 'Could not reach the server. Check your connection.' });
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    // An expired or revoked token ends the session everywhere; the router sends the user to login.
    if (response.status === 401 && path !== LOGIN_PATH) session.end('expired');
    throw new ApiError(response.status, payload as Partial<ErrorBody>);
  }
  return payload as T;
}

function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}
