import { BusinessRuleViolationError } from '../../../../shared/domain/domain-errors';
import { TaxId } from './tax-id';

describe('TaxId', () => {
  it('normalises separators and masks all but the last four characters', () => {
    const taxId = TaxId.of('00-0001234');
    expect(taxId.reveal()).toBe('000001234');
    expect(taxId.masked()).toBe('*****1234');
    expect(taxId.lastFour()).toBe('1234');
  });

  it('is masked when converted to string or JSON', () => {
    const taxId = TaxId.of('000001234');
    expect(`${taxId}`).toBe('*****1234');
    expect(JSON.stringify({ taxId })).toBe('{"taxId":"*****1234"}');
  });

  it.each(['123', 'abc$%^123', ''])('rejects invalid value %p', (value) => {
    expect(() => TaxId.of(value)).toThrow(BusinessRuleViolationError);
  });
});
