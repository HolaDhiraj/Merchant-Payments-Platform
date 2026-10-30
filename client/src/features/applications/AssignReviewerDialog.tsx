import { useState } from 'react';
import { commands, useApplicationCommand, useReviewers } from '@/api/queries';
import type { MerchantApplication } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';

interface AssignReviewerDialogProps {
  application: MerchantApplication;
  onClose(): void;
}

// Mounted only while open, so the selection always starts from the current assignee.
export function AssignReviewerDialog({ application, onClose }: AssignReviewerDialogProps) {
  const reviewers = useReviewers(true);
  const assign = useApplicationCommand(commands.assignReviewer, application.id);
  const toast = useToast();
  const [reviewerId, setReviewerId] = useState(application.assignedReviewerId ?? '');

  function submit() {
    if (!reviewerId) return;
    assign.mutate(reviewerId, {
      onSuccess: () => {
        const name = reviewers.data?.find((reviewer) => reviewer.id === reviewerId)?.fullName;
        toast.success(name ? `Assigned to ${name}` : 'Reviewer assigned');
        onClose();
      },
    });
  }

  const unchanged = reviewerId === (application.assignedReviewerId ?? '');

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={assign.isPending}
      title={application.assignedReviewerId ? 'Reassign reviewer' : 'Assign reviewer'}
      description="Only the assigned reviewer can record the decision."
      footer={
        <>
          <Button onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={assign.isPending} disabled={!reviewerId || unchanged}>
            Assign
          </Button>
        </>
      }
    >
      {assign.isError && <Callout tone="danger">{errorMessage(assign.error)}</Callout>}
      {reviewers.isPending && <Spinner label="Loading reviewers" />}
      {reviewers.isError && <Callout tone="danger">{errorMessage(reviewers.error)}</Callout>}
      {reviewers.data && reviewers.data.length === 0 && (
        <Callout tone="warning" title="No active reviewers">
          Add a reviewer from the Team page first.
        </Callout>
      )}
      {reviewers.data && reviewers.data.length > 0 && (
        <Field label="Reviewer">
          <Select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
            <option value="" disabled>
              Choose a reviewer
            </option>
            {reviewers.data.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.fullName} · {reviewer.email}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Dialog>
  );
}
