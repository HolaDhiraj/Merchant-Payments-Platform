import { Clock } from '../../../src/shared/domain/clock';
import { IdGenerator } from '../../../src/shared/domain/id-generator';

export class FixedClock implements Clock {
  constructor(private current = new Date('2026-01-01T00:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

// Produces valid, predictable UUIDs: 00000000-0000-4000-8000-000000000001, ...
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${this.counter.toString().padStart(12, '0')}`;
  }
}
