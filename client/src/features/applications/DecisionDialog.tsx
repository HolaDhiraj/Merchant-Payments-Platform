import { useState } from 'react';
import { commands, useApplicationCommand } from '@/api/queries';
import type { MerchantApplication, ReviewDecision } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { DECISION_LABEL } from '@/lib/labels';
import styles from './DecisionDialog.module.css';

const OPTIONS: Array<{ value: ReviewDecision; title: string; text: string }> = [
  { value: 'APPROVE', title: 'Approve', text: 'The merchant can start processing payments.' },
  { value: 'REQUEST_INFO', title: 'Request more information', text: 'Sends it back to sales to update and resubmit.' },
  { value: 'REJECT', title: 'Reject', text: 'Final. The merchant will not be onboarded.' },
];

const REASON_MAX = 1000;

interface DecisionDialogProps {
  application: MerchantApplication;
  onClose(): void;
}

// Mounted only while open, so every opening starts from a clean form.
export function DecisionDialog({ application, onClose }: DecisionDialogProps) {
  const [decision, setDecision] = useState<ReviewDecision>('APPROVE');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const decide = useApplicationCommand(commands.decide, application.id);
  const toast = useToast();

  // Same rules as the server: a reason is required unless approving a non-HIGH risk merchant.
  const needsReason = decision !== 'APPROVE' || application.riskLevel === 'HIGH';
  const reasonError = needsReason && !reason.trim() ? 'Add a reason for this decision.' : undefined;

  function submit() {
    setShowErrors(true);
    if (reasonError) return;
    decide.mutate(
      { decision, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`${application.businessName}: ${DECISION_LABEL[decision].toLowerCase()}`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={decide.isPending}
      title="Record decision"
      description={application.businessName}
      footer={
        <>
          <Button onClick={onClose} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant={decision === 'REJECT' ? 'danger' : 'primary'} loading={decide.isPending}>
            {decision === 'APPROVE' ? 'Approve' : decision === 'REJECT' ? 'Reject' : 'Send back'}
          </Button>
        </>
      }
    >
      {decide.isError && <Callout tone="danger">{errorMessage(decide.error)}</Callout>}

      {application.riskLevel === 'HIGH' && decision === 'APPROVE' && (
        <Callout tone="warning">This merchant scored high risk. Approving it needs a written justification.</Callout>
      )}

      <fieldset className={styles.options}>
        <legend className={styles.legend}>Decision</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="decision"
              value={option.value}
              checked={decision === option.value}
              onChange={() => setDecision(option.value)}
            />
            <span>
              <span className={styles.optionTitle}>{option.title}</span>
              <br />
              <span className={styles.optionText}>{option.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field
        label={decision === 'REQUEST_INFO' ? 'What do you need from sales?' : 'Reason'}
        optional={!needsReason}
        error={showErrors ? reasonError : undefined}
        hint={`Kept in the audit trail. ${reason.length}/${REASON_MAX}`}
      >
        <Textarea value={reason} maxLength={REASON_MAX} onChange={(event) => setReason(event.target.value)} rows={4} />
      </Field>
    </Dialog>
  );
}
