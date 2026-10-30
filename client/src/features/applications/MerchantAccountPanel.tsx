import { useState } from 'react';
import { ApiError } from '@/api/http';
import { useMerchantForApplication, useOnboardApplication, useResetOwnerPassword } from '@/api/portalQueries';
import type { MerchantApplication } from '@/api/types';
import { CredentialsDialog } from '@/components/portal/CredentialsDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { DetailList, Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import styles from './MerchantAccountPanel.module.css';

interface IssuedCredentials {
  title: string;
  email: string;
  temporaryPassword: string;
}

// For approved applications (platform admins): the merchant account it became, and the owner's sign-in.
export function MerchantAccountPanel({ application }: { application: MerchantApplication }) {
  const merchant = useMerchantForApplication(application.id, true);
  const onboard = useOnboardApplication(application.id);
  const resetPassword = useResetOwnerPassword();
  const toast = useToast();
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);

  const notOnboarded = merchant.error instanceof ApiError && merchant.error.isNotFound;
  const owner = merchant.data?.owner;

  function openAccount() {
    onboard.mutate(undefined, {
      onSuccess: (credentials) => {
        void merchant.refetch();
        setIssued({ title: 'Merchant account opened', ...credentials, email: credentials.ownerEmail });
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  function newOwnerPassword() {
    if (!merchant.data) return;
    resetPassword.mutate(merchant.data.id, {
      onSuccess: (result) => {
        void merchant.refetch();
        setIssued({ title: 'New owner password', ...result });
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  return (
    <Panel
      title="Merchant account"
      actions={
        owner && (
          <Button size="sm" icon="shield" loading={resetPassword.isPending} onClick={newOwnerPassword}>
            New owner password
          </Button>
        )
      }
    >
      {merchant.isPending && <Skeleton width="60%" />}
      {notOnboarded && (
        <Callout title="No merchant account yet" tone="attention">
          This application was approved before accounts were opened automatically.
          <div className={styles.action}>
            <Button size="sm" variant="primary" icon="store" loading={onboard.isPending} onClick={openAccount}>
              Open merchant account
            </Button>
          </div>
        </Callout>
      )}
      {merchant.isError && !notOnboarded && <Callout tone="danger">{errorMessage(merchant.error)}</Callout>}
      {merchant.data && (
        <DetailList
          items={[
            ['Merchant', merchant.data.tradingName],
            ['Owner', owner ? `${owner.fullName} · ${owner.email}` : '—'],
            [
              'Owner sign-in',
              owner?.mustChangePassword ? (
                <Badge tone="warning" dot>
                  Waiting for first sign-in
                </Badge>
              ) : (
                <Badge tone="success" dot>
                  Active
                </Badge>
              ),
            ],
            ['Opened', formatDateTime(merchant.data.createdAt)],
          ]}
        />
      )}
      {issued && (
        <CredentialsDialog
          title={issued.title}
          description={`Owner sign-in for ${application.businessName}.`}
          email={issued.email}
          temporaryPassword={issued.temporaryPassword}
          onClose={() => setIssued(null)}
        />
      )}
    </Panel>
  );
}
