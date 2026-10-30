import { commands, useApplicationCommand, useRiskAssessment } from '@/api/queries';
import type { MerchantApplication, RiskLevel, User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { DetailList, Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { RiskLevelBadge } from './Badges';
import { canRetryRiskReview } from './permissions';
import styles from './RiskPanel.module.css';

// A pending check older than this is worth offering a manual retry for.
const STUCK_AFTER_MS = 2 * 60 * 1000;

const BANDS: Array<{ level: RiskLevel; className: string }> = [
  { level: 'LOW', className: styles.low },
  { level: 'MEDIUM', className: styles.medium },
  { level: 'HIGH', className: styles.high },
];

interface RiskPanelProps {
  application: MerchantApplication;
  user: User;
}

export function RiskPanel({ application, user }: RiskPanelProps) {
  const assessment = useRiskAssessment(application);
  const retry = useApplicationCommand(commands.retryRiskReview, application.id);
  const toast = useToast();

  const looksStuck =
    application.riskStatus === 'PENDING' &&
    Date.now() - new Date(application.updatedAt).getTime() > STUCK_AFTER_MS;
  const showRetry = canRetryRiskReview(user, application) && (application.riskStatus === 'FAILED' || looksStuck);

  const retryButton = showRetry && (
    <Button
      size="sm"
      icon="refresh"
      loading={retry.isPending}
      onClick={() =>
        retry.mutate(undefined, {
          onSuccess: () => toast.success('Risk check queued again'),
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    >
      Retry check
    </Button>
  );

  return (
    <Panel title="Risk assessment" actions={retryButton}>
      {application.riskStatus === 'NOT_STARTED' && (
        <p className={styles.muted}>Runs automatically with a third-party provider once the application is submitted.</p>
      )}

      {application.riskStatus === 'PENDING' && (
        <div className={styles.state}>
          <div className={styles.waiting}>
            <Spinner label="Risk check running" />
            <span>Checking with the risk provider…</span>
          </div>
          <p className={styles.muted}>
            {looksStuck
              ? `Started ${formatRelative(application.updatedAt)}. This is taking longer than usual.`
              : 'This page updates on its own when the result arrives.'}
          </p>
        </div>
      )}

      {application.riskStatus === 'FAILED' && (
        <Callout tone="danger" title="The risk check could not be completed">
          The provider kept failing after several automatic retries. The application stays submitted until the
          check is retried{user.role === 'ADMIN' ? '.' : ' by an admin.'}
        </Callout>
      )}

      {application.riskStatus === 'COMPLETED' && assessment.isPending && (
        <div className={styles.state}>
          <Skeleton width={80} height={32} />
          <Skeleton />
          <Skeleton width="60%" />
        </div>
      )}

      {application.riskStatus === 'COMPLETED' && assessment.isError && (
        <Callout tone="danger">{errorMessage(assessment.error)}</Callout>
      )}

      {assessment.data && (
        <>
          <div className={styles.scoreRow}>
            <div>
              <span className={styles.score}>{assessment.data.score}</span>
              <span className={styles.outOf}>/ 100</span>
            </div>
            <RiskLevelBadge level={assessment.data.level} />
          </div>

          <div className={styles.meter} role="img" aria-label={`Score ${assessment.data.score} of 100`}>
            {BANDS.map((band) => (
              <span
                key={band.level}
                className={cx(styles.band, band.className, band.level === assessment.data.level && styles.active)}
              />
            ))}
            <span className={styles.marker} style={{ left: `${assessment.data.score}%` }} />
          </div>

          {assessment.data.reasons.length > 0 && (
            <>
              <h3 className={styles.reasonsTitle}>Signals</h3>
              <ul className={styles.reasons}>
                {assessment.data.reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </>
          )}

          <div className={styles.meta}>
            <DetailList
              items={[
                ['Provider', assessment.data.provider],
                ['Reference', <span className="mono">{assessment.data.providerReference}</span>],
                ['Assessed', formatDateTime(assessment.data.assessedAt)],
                ['Submission', `#${assessment.data.submissionNumber}`],
              ]}
            />
          </div>
        </>
      )}
    </Panel>
  );
}
