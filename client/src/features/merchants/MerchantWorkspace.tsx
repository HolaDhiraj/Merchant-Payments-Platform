import { Suspense } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { MerchantScopeProvider } from '@/api/merchantScope';
import { useMerchantProfile } from '@/api/portalQueries';
import type { Merchant } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/Spinner';
import { NotFound } from '@/features/errors/NotAllowed';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import styles from './MerchantWorkspace.module.css';

const SECTIONS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '', label: 'Overview', icon: 'chart', end: true },
  { to: 'payments', label: 'Payments', icon: 'receipt' },
  { to: 'customers', label: 'Customers', icon: 'users' },
  { to: 'products', label: 'Products', icon: 'tag' },
  { to: 'team', label: 'Team', icon: 'user' },
  { to: 'profile', label: 'Profile', icon: 'store' },
];

// A platform admin's read-only view of one merchant. The merchant portal's own screens render
// inside it, scoped to this merchant, so the admin sees exactly what the merchant sees, minus
// every action: payments are taken and reviewed by the merchant's own people.
export function MerchantWorkspace() {
  const { merchantId = '' } = useParams();
  return (
    <MerchantScopeProvider merchantId={merchantId}>
      <Workspace />
    </MerchantScopeProvider>
  );
}

function Workspace() {
  const merchant = useMerchantProfile();
  if (merchant.isPending) return <PageLoader label="Loading merchant" />;
  if (merchant.error instanceof ApiError && (merchant.error.isNotFound || merchant.error.status === 400)) {
    return <NotFound />;
  }
  if (merchant.isError) {
    return (
      <Callout tone="danger" title="Couldn't load this merchant">
        {errorMessage(merchant.error)}
      </Callout>
    );
  }
  return (
    <>
      <WorkspaceHeader merchant={merchant.data} />
      <nav className={styles.sections} aria-label="Merchant sections">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.label}
            to={section.to}
            end={section.end}
            className={({ isActive }) => cx(styles.section, isActive && styles.active)}
          >
            <Icon name={section.icon} size={15} />
            {section.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function WorkspaceHeader({ merchant }: { merchant: Merchant }) {
  return (
    <header className={styles.header}>
      <Link to="/merchants" className={styles.back}>
        <Icon name="chevronLeft" size={14} />
        Merchants
      </Link>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden>
          {merchant.tradingName.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.names}>
          <div className={styles.titleRow}>
            <p className={styles.title}>{merchant.tradingName}</p>
            <Badge tone={merchant.status === 'ACTIVE' ? 'success' : 'warning'} dot>
              {merchant.status === 'ACTIVE' ? 'Active' : 'Suspended'}
            </Badge>
            <Badge tone="outline" title="You can look at everything here but not change it">
              <Icon name="eye" size={12} /> Monitoring
            </Badge>
          </div>
          <p className={styles.meta}>
            {merchant.legalName} · <span className="mono">{merchant.currency}</span> · opened {formatDate(merchant.createdAt)}
            {merchant.owner && ` · owner ${merchant.owner.fullName}`}
          </p>
        </div>
        <ButtonLink to={`/applications/${merchant.applicationId}`} variant="secondary" size="sm" icon="file">
          Application
        </ButtonLink>
      </div>
    </header>
  );
}

