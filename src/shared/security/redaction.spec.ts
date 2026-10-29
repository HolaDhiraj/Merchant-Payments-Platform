import { maskEmail, maskValue, REDACTED, redactSensitive } from './redaction';

describe('redactSensitive', () => {
  it('removes secrets at any depth, regardless of key casing or separators', () => {
    const output = redactSensitive({
      password: 'p',
      nested: {
        access_token: 't',
        Authorization: 'Bearer x',
        apiKey: 'k',
        list: [{ refreshToken: 'r' }],
      },
    });
    expect(output).toEqual({
      password: REDACTED,
      nested: {
        access_token: REDACTED,
        Authorization: REDACTED,
        apiKey: REDACTED,
        list: [{ refreshToken: REDACTED }],
      },
    });
  });

  it('masks personal data instead of dropping it', () => {
    expect(
      redactSensitive({ taxId: '000001234', email: 'jane@example.test', phone: '+15555550100' }),
    ).toEqual({
      taxId: '*****1234',
      email: 'j***@example.test',
      phone: '********0100',
    });
  });

  it('leaves non-sensitive values and dates untouched and does not mutate the input', () => {
    const date = new Date();
    const input = { status: 'DRAFT', count: 2, at: date, password: 'x' };
    const output = redactSensitive(input) as Record<string, unknown>;
    expect(output).toMatchObject({ status: 'DRAFT', count: 2, at: date });
    expect(input.password).toBe('x');
  });
});

describe('masking helpers', () => {
  it('maskValue keeps the last four characters', () => {
    expect(maskValue('123456789')).toBe('*****6789');
    expect(maskValue('123')).toBe('***');
  });

  it('maskEmail keeps the domain', () => {
    expect(maskEmail('someone@example.test')).toBe('s***@example.test');
  });
});
