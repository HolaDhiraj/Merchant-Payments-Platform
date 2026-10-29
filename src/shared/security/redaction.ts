// Central list of field names that must never appear in logs or audit metadata in clear text.
// Matching is case-insensitive and ignores "_" / "-" so "access_token" and "accessToken" both match.
const SECRET_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'cookie',
];

// Personal or regulated data: kept out of logs but partially shown (masked).
const MASKED_KEYS = [
  'taxid',
  'taxidentificationnumber',
  'email',
  'phone',
  'owneremail',
  'ownerphone',
  'accountnumber',
];

export const REDACTED = '[REDACTED]';

function normalise(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

// Keeps only the last 4 characters visible, e.g. "123456789" -> "*****6789".
export function maskValue(value: string, visible = 4): string {
  if (value.length <= visible) {
    return '*'.repeat(value.length);
  }
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

// Masks the local part of an email but keeps the domain for troubleshooting, e.g. "j***@acme.test".
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) {
    return maskValue(email);
  }
  return `${local.charAt(0)}***@${domain}`;
}

// Returns a deep copy of the input with secrets removed and personal data masked.
// Safe to call on any request body, error payload or audit metadata.
export function redactSensitive(input: unknown, depth = 0): unknown {
  if (depth > 10 || input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof input !== 'object' || input instanceof Date) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalisedKey = normalise(key);
    if (SECRET_KEYS.some((secretKey) => normalisedKey.includes(secretKey))) {
      output[key] = REDACTED;
    } else if (MASKED_KEYS.includes(normalisedKey) && typeof value === 'string') {
      output[key] = normalisedKey.includes('email') ? maskEmail(value) : maskValue(value);
    } else {
      output[key] = redactSensitive(value, depth + 1);
    }
  }
  return output;
}
