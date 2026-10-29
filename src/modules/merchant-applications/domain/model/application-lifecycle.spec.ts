import { InvalidStateTransitionError } from '../../../../shared/domain/domain-errors';
import { ApplicationLifecycle } from './application-lifecycle';
import { ApplicationStatus as S } from './application-status.enum';

describe('ApplicationLifecycle', () => {
  const allowed: Array<[S, S]> = [
    [S.DRAFT, S.SUBMITTED],
    [S.SUBMITTED, S.UNDER_REVIEW],
    [S.UNDER_REVIEW, S.APPROVED],
    [S.UNDER_REVIEW, S.REJECTED],
    [S.UNDER_REVIEW, S.INFO_REQUESTED],
    [S.INFO_REQUESTED, S.SUBMITTED],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(ApplicationLifecycle.canTransition(from, to)).toBe(true);
  });

  // Every pair not explicitly allowed must be rejected.
  const all = Object.values(S);
  const forbidden = all
    .flatMap((from) => all.map((to) => [from, to] as [S, S]))
    .filter(([from, to]) => !allowed.some(([f, t]) => f === from && t === to));

  it.each(forbidden)('forbids %s -> %s', (from, to) => {
    expect(() => ApplicationLifecycle.assertTransition(from, to, 'test')).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('only DRAFT and INFO_REQUESTED are editable', () => {
    expect(all.filter((status) => ApplicationLifecycle.isEditable(status))).toEqual([
      S.DRAFT,
      S.INFO_REQUESTED,
    ]);
  });

  it('APPROVED and REJECTED are terminal', () => {
    expect(all.filter((status) => ApplicationLifecycle.isTerminal(status))).toEqual([
      S.APPROVED,
      S.REJECTED,
    ]);
  });
});
