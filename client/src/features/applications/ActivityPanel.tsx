import { Link } from 'react-router-dom';
import { useAuditLog } from '@/api/queries';
import type { AuditLogEntry, MerchantApplication } from '@/api/types';
import { Callout } from '@/components/ui/Callout';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative, humanize } from '@/lib/format';
import { AUDIT_ACTION_LABEL } from '@/lib/labels';
import styles from './ActivityPanel.module.css';

const SHOWN = 8;

// A short summary of the event's metadata (keys as recorded by the API's use cases).
function describe(entry: AuditLogEntry): string | null {
  const value = (key: string) => {
    const raw = entry.metadata[key];
    return raw === undefined || raw === null ? null : String(raw);
  };
  switch (entry.action) {
    case 'REVIEW_DECISION_RECORDED':
      return value('decision') && humanize(value('decision')!);
    case 'RISK_REVIEW_COMPLETED':
      return value('riskLevel') && `${humanize(value('riskLevel')!)} risk, score ${value('riskScore')}`;
    case 'RISK_REVIEW_FAILED':
      return value('attempts') && `Gave up after ${value('attempts')} attempts`;
    case 'APPLICATION_SUBMITTED':
    case 'RISK_REVIEW_RETRIED':
      return value('submissionNumber') && `Submission #${value('submissionNumber')}`;
    case 'APPLICATION_UPDATED': {
      const fields = entry.metadata.changedFields;
      return Array.isArray(fields) && fields.length ? `Changed ${fields.join(', ')}` : null;
    }
    default:
      return null;
  }
}

// Recent audit events for one application (admins only: the audit API is admin-only).
export function ActivityPanel({ application }: { application: MerchantApplication }) {
  const audit = useAuditLog({ entityId: application.id, pageSize: SHOWN });

  return (
    <Panel title="Activity">
      {audit.isPending && (
        <div className={styles.loading}>
          <Skeleton width="70%" />
          <Skeleton width="50%" />
          <Skeleton width="60%" />
        </div>
      )}
      {audit.isError && <Callout tone="danger">{errorMessage(audit.error)}</Callout>}
      {audit.data && (
        <>
          <ol className={styles.list}>
            {audit.data.items.map((entry) => {
              const detail = describe(entry);
              return (
                <li key={entry.id} className={styles.item}>
                  <span className={styles.action}>{AUDIT_ACTION_LABEL[entry.action] ?? humanize(entry.action)}</span>
                  {detail && <span className={styles.detail}>{detail}</span>}
                  <span className={styles.meta} title={formatDateTime(entry.occurredAt)}>
                    {humanize(entry.actorRole)} · {formatRelative(entry.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ol>
          {audit.data.totalItems > SHOWN && (
            <div className={styles.footer}>
              <Link to={`/audit?entityId=${application.id}`}>View all {audit.data.totalItems} events</Link>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
