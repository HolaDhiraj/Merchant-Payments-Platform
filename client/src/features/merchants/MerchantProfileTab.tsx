import { useMerchantProfile } from '@/api/portalQueries';
import type { Merchant } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { DetailList, Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { BUSINESS_TYPE_LABEL } from '@/lib/labels';
import { formatDate, formatMoney } from '@/lib/format';
import styles from './MerchantWorkspace.module.css';

// The merchant's business details and the settings its admin chose, as a platform admin sees them.
export function MerchantProfileTab() {
  const merchant = useMerchantProfile();
  // The workspace has loaded it already; this only covers a refetch.
  if (!merchant.data) return <PageLoader label="Loading profile" />;
  return <Profile merchant={merchant.data} />;
}

function Profile({ merchant }: { merchant: Merchant }) {
  const money = (minor: number) => <span className="mono">{formatMoney(minor, merchant.currency)}</span>;
  const { loyalty, acceptedMethods } = merchant;
  const methods = [
    acceptedMethods.cash && 'Cash',
    acceptedMethods.card && 'Card',
    acceptedMethods.bankTransfer && 'Bank transfer',
    acceptedMethods.qr && 'QR',
  ].filter((method): method is string => Boolean(method));

  return (
    <div className={styles.grid}>
      <Panel title="Business">
        <DetailList
          items={[
            ['Trading name', merchant.tradingName],
            ['Legal name', merchant.legalName],
            ['Business type', BUSINESS_TYPE_LABEL[merchant.businessType]],
            ['Category code (MCC)', <span className="mono">{merchant.merchantCategoryCode}</span>],
            ['Currency', <span className="mono">{merchant.currency}</span>],
            ['Opened', formatDate(merchant.createdAt)],
          ]}
        />
      </Panel>

      <Panel title="Contact and owner">
        <DetailList
          items={[
            ['Contact', merchant.contactName],
            ['Email', merchant.contactEmail],
            ['Phone', <span className="mono">{merchant.contactPhone}</span>],
            [
              'Owner account',
              merchant.owner ? (
                <span>
                  {merchant.owner.email}{' '}
                  {!merchant.owner.isActive ? (
                    <Badge tone="danger">Deactivated</Badge>
                  ) : (
                    merchant.owner.mustChangePassword && <Badge tone="warning">Not signed in yet</Badge>
                  )}
                </span>
              ) : (
                '—'
              ),
            ],
          ]}
        />
      </Panel>

      <Panel title="Payments">
        <DetailList
          items={[
            [
              'Accepts',
              methods.length ? (
                <span className={styles.methods}>
                  {methods.map((method) => (
                    <Badge key={method} tone="outline">
                      {method}
                    </Badge>
                  ))}
                </span>
              ) : (
                'Nothing yet'
              ),
            ],
            ['Held for review from', money(merchant.highValueThresholdMinor)],
            [
              'Settlement account',
              merchant.settlement ? (
                <span>
                  {merchant.settlement.bankName} · {merchant.settlement.accountHolder} ·{' '}
                  <span className="mono">•••• {merchant.settlement.accountLast4}</span>
                </span>
              ) : (
                <Badge tone="warning">Not set up</Badge>
              ),
            ],
          ]}
        />
      </Panel>

      <Panel title="Loyalty points">
        {loyalty.enabled ? (
          <DetailList
            items={[
              ['Earns', <span>1 point per {money(loyalty.earnUnitMinor)} spent</span>],
              ['Each point is worth', money(loyalty.pointValueMinor)],
              ['Points can pay up to', `${loyalty.maxRedeemPercent}% of a purchase`],
            ]}
          />
        ) : (
          <p className="tabular">Switched off. Customers keep the points they already have.</p>
        )}
      </Panel>
    </div>
  );
}
