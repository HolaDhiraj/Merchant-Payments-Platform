// Display formatting. Money arrives in minor units (cents) and is never handled as a float
// until the moment it is rendered.

const fractionDigitsCache = new Map<string, number>();

function fractionDigits(currency: string): number {
  const code = currency.toUpperCase();
  let digits = fractionDigitsCache.get(code);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat('en', { style: 'currency', currency: code })
        .resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    fractionDigitsCache.set(code, digits);
  }
  return digits;
}

export function formatMoney(minor: number, currency: string, options: { compact?: boolean } = {}): string {
  const code = currency.toUpperCase();
  const major = minor / 10 ** fractionDigits(code);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      notation: options.compact ? 'compact' : 'standard',
      maximumFractionDigits: options.compact ? 1 : undefined,
    }).format(major);
  } catch {
    return `${major.toLocaleString('en')} ${code}`;
  }
}

// Converts a user-typed major amount ("1,250.50") to integer minor units, or null if invalid.
export function toMinorUnits(input: string, currency: string): number | null {
  const normalised = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const minor = Math.round(Number(normalised) * 10 ** fractionDigits(currency || 'USD'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function toMajorInput(minor: number, currency: string): string {
  return String(minor / 10 ** fractionDigits(currency));
}

const dateTime = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function formatDate(iso: string | null): string {
  return iso ? dateOnly.format(new Date(iso)) : '—';
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

export function formatRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  let value = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) {
      return unit === 'second' && Math.abs(value) < 30 ? 'just now' : relative.format(Math.round(value), unit);
    }
    value /= size;
  }
  return formatDate(iso);
}

// First block of a UUID: enough to tell records apart in a list.
export function shortId(id: string): string {
  return id.split('-')[0];
}

export function humanize(value: string): string {
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
