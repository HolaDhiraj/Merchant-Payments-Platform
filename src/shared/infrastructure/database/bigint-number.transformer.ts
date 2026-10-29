import { ValueTransformer } from 'typeorm';

// PostgreSQL returns BIGINT as a string. Money is stored in minor units (e.g. cents) and is
// validated to stay below Number.MAX_SAFE_INTEGER, so converting to number is lossless here.
export const bigintNumberTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
