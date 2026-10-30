import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuditLog } from '@/api/queries';
import type { AuditAction, AuditLogEntry } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative, humanize, shortId } from '@/lib/format';
import { AUDIT_ACTION_LABEL } from '@/lib/labels';
import styles from './AuditLogPage.module.css';

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const action = (params.get('action') as AuditAction | null) ?? undefined;
  const entityId = params.get('entityId') ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [entityInput, setEntityInput] = useState(entityId ?? '');

  const query = useAuditLog({ action, entityId, page, pageSize: PAGE_SIZE });
  const entityInvalid = entityInput.trim() !== '' && !UUID.test(entityInput.trim());

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  }

  const data = query.data;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every significant action, who took it and when. Sensitive values are redacted." />

      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          if (!entityInvalid) update({ entityId: entityInput.trim() || undefined, page: undefined });
        }}
      >
        <Field label="Action" className={styles.filter}>
          <Select value={action ?? ''} onChange={(event) => update({ action: event.target.value || undefined, page: undefined })}>
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Record ID" className={styles.entity} error={entityInvalid ? 'Paste a full ID (UUID).' : undefined}>
          <Input
            value={entityInput}
            onChange={(event) => setEntityInput(event.target.value)}
            placeholder="Application or user ID"
            className="mono"
          />
        </Field>
        <Button type="submit">Apply</Button>
        {(action || entityId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setEntityInput('');
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            Clear filters
          </Button>
        )}
      </form>

      {query.isError ? (
        <Callout tone="danger" title="Couldn't load the audit log">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState icon="log" title="No matching events">
              Adjust the filters to widen the search.
            </EmptyState>
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Record</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={5} />}
                    {data?.items.map((entry) => (
                      <tr key={entry.id}>
                        <td className={table.muted} title={formatDateTime(entry.occurredAt)}>
                          {formatRelative(entry.occurredAt)}
                          <span className={table.secondary}>{formatDateTime(entry.occurredAt)}</span>
                        </td>
                        <td className={table.primary}>{AUDIT_ACTION_LABEL[entry.action] ?? humanize(entry.action)}</td>
                        <td>
                          <span className={styles.actor}>
                            {humanize(entry.actorRole)}
                            {entry.actorId && <span className={cx(table.secondary, 'mono')}>{shortId(entry.actorId)}</span>}
                          </span>
                        </td>
                        <td>
                          <EntityLink entry={entry} />
                        </td>
                        <td>
                          <Metadata metadata={entry.metadata} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && (
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  totalItems={data.totalItems}
                  totalPages={data.totalPages}
                  onChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
                />
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}

function EntityLink({ entry }: { entry: AuditLogEntry }) {
  const label = (
    <>
      {humanize(entry.entityType.replace(/([a-z])([A-Z])/g, '$1_$2'))}
      <span className={cx(table.secondary, 'mono')}>{shortId(entry.entityId)}</span>
    </>
  );
  return entry.entityType === 'MerchantApplication' ? (
    <Link to={`/applications/${entry.entityId}`}>{label}</Link>
  ) : (
    <span>{label}</span>
  );
}

function Metadata({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (entries.length === 0) return <span className={table.muted}>—</span>;
  return (
    <span className={styles.metadata}>
      {entries.map(([key, value]) => (
        <span key={key}>
          <span className={styles.key}>{humanize(key.replace(/([a-z])([A-Z])/g, '$1_$2'))}:</span>{' '}
          {Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </span>
      ))}
    </span>
  );
}
