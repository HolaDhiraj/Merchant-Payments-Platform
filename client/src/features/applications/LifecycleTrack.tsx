import type { MerchantApplication } from '@/api/types';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import styles from './LifecycleTrack.module.css';

type StepState = 'todo' | 'current' | 'done' | 'attention' | 'danger';

interface Step {
  label: string;
  state: StepState;
}

// Where the application sits in DRAFT → SUBMITTED → risk check → UNDER_REVIEW → decision.
function buildSteps(app: MerchantApplication): Step[] {
  const position: Record<MerchantApplication['status'], number> = {
    DRAFT: 0,
    SUBMITTED: 2,
    UNDER_REVIEW: 3,
    INFO_REQUESTED: 4,
    APPROVED: 4,
    REJECTED: 4,
  };
  const current = position[app.status];
  const at = (index: number): StepState => (index < current ? 'done' : index === current ? 'current' : 'todo');

  const steps: Step[] = [
    { label: 'Draft', state: at(0) },
    { label: 'Submitted', state: at(1) },
    { label: 'Risk check', state: app.riskStatus === 'FAILED' ? 'danger' : at(2) },
    { label: 'Review', state: at(3) },
    { label: 'Decision', state: at(4) },
  ];

  const decision = steps[4];
  if (app.status === 'APPROVED') Object.assign(decision, { label: 'Approved', state: 'done' });
  if (app.status === 'REJECTED') Object.assign(decision, { label: 'Rejected', state: 'danger' });
  if (app.status === 'INFO_REQUESTED') Object.assign(decision, { label: 'Info requested', state: 'attention' });
  return steps;
}

export function LifecycleTrack({ application }: { application: MerchantApplication }) {
  return (
    <ol className={styles.track} aria-label="Application progress">
      {buildSteps(application).map((step) => (
        <li
          key={step.label}
          className={cx(styles.step, step.state !== 'todo' && styles[step.state])}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span className={styles.label}>
            {step.state === 'done' && <Icon name="check" size={13} />}
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
