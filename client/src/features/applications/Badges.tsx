import type { ApplicationStatus, MerchantApplication, RiskLevel } from '@/api/types';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { RISK_LABEL, STATUS_LABEL } from '@/lib/labels';
import styles from './Badges.module.css';

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  INFO_REQUESTED: 'attention',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK_TONE[level]}>{RISK_LABEL[level]}</Badge>;
}

// Compact risk cell for tables: level and score, or the state of the background check.
export function RiskSummary({ application }: { application: MerchantApplication }) {
  switch (application.riskStatus) {
    case 'COMPLETED':
      return application.riskLevel ? (
        <span className={styles.risk}>
          <RiskLevelBadge level={application.riskLevel} />
          <span className={`${styles.score} mono`}>{application.riskScore}</span>
        </span>
      ) : null;
    case 'PENDING':
      return (
        <span className={styles.pending}>
          <Spinner size="sm" label="Risk check running" />
          Checking
        </span>
      );
    case 'FAILED':
      return <Badge tone="danger">Check failed</Badge>;
    default:
      return <span className={styles.none}>—</span>;
  }
}
