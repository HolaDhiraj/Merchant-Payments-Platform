import { useReviewers } from '@/api/queries';
import type { MerchantApplication, User } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DetailList, Panel } from '@/components/ui/Panel';
import { formatDateTime, shortId } from '@/lib/format';
import { DECISION_LABEL } from '@/lib/labels';
import { canAssignReviewer } from './permissions';
import styles from './ApplicationDetailPage.module.css';

interface ReviewPanelProps {
  application: MerchantApplication;
  user: User;
  onAssign(): void;
}

export function ReviewPanel({ application, user, onAssign }: ReviewPanelProps) {
  // Only admins may list users, so only they see reviewer names; others see "you" or an id.
  const reviewers = useReviewers(user.role === 'ADMIN' && Boolean(application.assignedReviewerId));
  const reviewerName = reviewers.data?.find((reviewer) => reviewer.id === application.assignedReviewerId)?.fullName;

  const reviewer = !application.assignedReviewerId ? (
    <span className={styles.faint}>Not assigned</span>
  ) : application.assignedReviewerId === user.id ? (
    <>
      {user.fullName}
      <span className={styles.you}>
        <Badge tone="accent">You</Badge>
      </span>
    </>
  ) : (
    reviewerName ?? <span className="mono">{shortId(application.assignedReviewerId)}</span>
  );

  return (
    <Panel
      title="Review"
      actions={
        canAssignReviewer(user, application) && (
          <Button size="sm" onClick={onAssign}>
            {application.assignedReviewerId ? 'Reassign' : 'Assign'}
          </Button>
        )
      }
    >
      <DetailList
        items={[
          ['Reviewer', reviewer],
          ['Submissions', application.submissionCount],
          ['Last submitted', formatDateTime(application.submittedAt)],
          ['Decision', application.decision ? DECISION_LABEL[application.decision] : '—'],
          ['Decided', formatDateTime(application.decidedAt)],
        ]}
      />
    </Panel>
  );
}
