import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { commands, useApplication, useApplicationCommand } from '@/api/queries';
import type { MerchantApplication } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { DetailList, Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { NotFound } from '@/features/errors/NotAllowed';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, shortId } from '@/lib/format';
import { BUSINESS_TYPE_LABEL, SALES_CHANNEL_LABEL } from '@/lib/labels';
import { ActivityPanel } from './ActivityPanel';
import { AssignReviewerDialog } from './AssignReviewerDialog';
import { StatusBadge } from './Badges';
import { DecisionDialog } from './DecisionDialog';
import { LifecycleTrack } from './LifecycleTrack';
import { ReviewPanel } from './ReviewPanel';
import { RiskPanel } from './RiskPanel';
import { canDecide, canEdit, canSubmit } from './permissions';
import styles from './ApplicationDetailPage.module.css';

type OpenDialog = 'decision' | 'assign' | null;

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const query = useApplication(id);

  if (query.isPending) return <PageLoader label="Loading application" />;
  if (query.isError) {
    // The API answers 404 both for missing records and ones this user may not see.
    if (query.error instanceof ApiError && (query.error.isNotFound || query.error.status === 400)) {
      return <NotFound />;
    }
    return <Callout tone="danger" title="Couldn't load this application">{errorMessage(query.error)}</Callout>;
  }
  return <ApplicationDetail application={query.data} />;
}

function ApplicationDetail({ application }: { application: MerchantApplication }) {
  const user = useCurrentUser();
  const toast = useToast();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const submit = useApplicationCommand(commands.submit, application.id);
  const { processing, owner } = application;

  const isResubmission = application.status === 'INFO_REQUESTED';

  function handleSubmit() {
    submit.mutate(undefined, {
      onSuccess: () => toast.success('Submitted. The risk check is running.'),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  const actions = (
    <>
      {canEdit(user, application) && (
        <ButtonLink to={`/applications/${application.id}/edit`} icon="pencil">
          Edit
        </ButtonLink>
      )}
      {canSubmit(user, application) && (
        <Button variant="primary" loading={submit.isPending} onClick={handleSubmit}>
          {isResubmission ? 'Resubmit for review' : 'Submit for review'}
        </Button>
      )}
      {canDecide(user, application) && (
        <Button variant="primary" onClick={() => setDialog('decision')}>
          Record decision
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        back={{ to: '/applications', label: 'Applications' }}
        title={application.businessName}
        badge={<StatusBadge status={application.status} />}
        subtitle={
          <span className={styles.subtitle}>
            {application.legalBusinessName}
            <span className={styles.sep}>·</span>
            {BUSINESS_TYPE_LABEL[application.businessType]}
            <span className={styles.sep}>·</span>
            <CopyId id={application.id} />
          </span>
        }
        actions={actions}
      />

      <LifecycleTrack application={application} />

      <DecisionCallout application={application} />

      <div className={styles.grid}>
        <div className={styles.column}>
          <Panel title="Business">
            <DetailList
              items={[
                ['Trading name', application.businessName],
                ['Legal name', application.legalBusinessName],
                ['Entity type', BUSINESS_TYPE_LABEL[application.businessType]],
                ['Tax ID', <span className="mono" title="Stored encrypted; only the last digits are shown">{application.taxIdMasked}</span>],
              ]}
            />
          </Panel>

          <Panel title="Owner">
            <DetailList
              items={[
                ['Name', owner.fullName],
                ['Email', <a href={`mailto:${owner.email}`}>{owner.email}</a>],
                ['Phone', <span className="mono">{owner.phone}</span>],
              ]}
            />
          </Panel>

          <Panel title="Processing profile">
            <DetailList
              items={[
                ['Monthly volume', <span className="mono">{formatMoney(processing.expectedMonthlyVolumeMinor, processing.currency)}</span>],
                ['Average ticket', <span className="mono">{formatMoney(processing.averageTicketMinor, processing.currency)}</span>],
                ['Currency', <span className="mono">{processing.currency.toUpperCase()}</span>],
                ['Category code', <span className="mono">{processing.merchantCategoryCode}</span>],
                ['Sales channel', SALES_CHANNEL_LABEL[processing.salesChannel]],
              ]}
            />
          </Panel>
        </div>

        <div className={styles.column}>
          <RiskPanel application={application} user={user} />
          <ReviewPanel application={application} user={user} onAssign={() => setDialog('assign')} />
          {user.role === 'ADMIN' && <ActivityPanel application={application} />}
          <p className={styles.stamp}>
            Created {formatDateTime(application.createdAt)} · Updated {formatDateTime(application.updatedAt)}
          </p>
        </div>
      </div>

      {dialog === 'decision' && <DecisionDialog application={application} onClose={() => setDialog(null)} />}
      {dialog === 'assign' && <AssignReviewerDialog application={application} onClose={() => setDialog(null)} />}
    </>
  );
}

function DecisionCallout({ application }: { application: MerchantApplication }) {
  const reason = application.decisionReason && <p className={styles.reason}>{application.decisionReason}</p>;
  switch (application.status) {
    case 'INFO_REQUESTED':
      return (
        <Callout tone="attention" title="The reviewer needs more information" className={styles.callout}>
          {reason}
        </Callout>
      );
    case 'REJECTED':
      return (
        <Callout tone="danger" title="Application rejected" className={styles.callout}>
          {reason}
        </Callout>
      );
    case 'APPROVED':
      return (
        <Callout tone="success" title="Approved for processing" className={styles.callout}>
          {reason}
        </Callout>
      );
    default:
      return null;
  }
}

function CopyId({ id }: { id: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={`${styles.copy} mono`}
      title="Copy application ID"
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(() => toast.success('Application ID copied'));
      }}
    >
      {shortId(id)}
      <Icon name="copy" size={13} />
    </button>
  );
}
