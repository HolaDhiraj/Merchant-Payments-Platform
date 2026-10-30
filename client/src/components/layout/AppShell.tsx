import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMerchantProfile } from '@/api/portalQueries';
import type { Role } from '@/api/types';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/Spinner';
import { cx } from '@/lib/cx';
import { ROLE_LABEL } from '@/lib/labels';
import { isMerchantRole } from '@/lib/roles';
import { ThemeSwitch } from './ThemeSwitch';
import { Wordmark } from './Wordmark';
import styles from './AppShell.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles?: Role[];
  // Only active on exactly this path (for section roots like /portal).
  end?: boolean;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

// Platform staff run onboarding; merchant users only ever see their own portal.
const PLATFORM_NAV: NavSection[] = [
  { items: [{ to: '/applications', label: 'Applications', icon: 'file' }] },
  {
    label: 'Administration',
    items: [
      { to: '/merchants', label: 'Merchants', icon: 'store', roles: ['ADMIN'] },
      { to: '/audit', label: 'Audit log', icon: 'log', roles: ['ADMIN'] },
      { to: '/team', label: 'Team', icon: 'users', roles: ['ADMIN'] },
    ],
  },
];

const MERCHANT_NAV: NavSection[] = [
  {
    items: [
      { to: '/portal', end: true, label: 'Overview', icon: 'chart', roles: ['MERCHANT_ADMIN', 'MERCHANT_REVIEWER'] },
      { to: '/portal/checkout', label: 'Checkout', icon: 'cart', roles: ['MERCHANT_ADMIN', 'MERCHANT_SALES'] },
      { to: '/portal/payments', label: 'Payments', icon: 'receipt' },
      { to: '/portal/customers', label: 'Customers', icon: 'users' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/portal/products', label: 'Products', icon: 'tag' },
      { to: '/portal/team', label: 'Team', icon: 'user', roles: ['MERCHANT_ADMIN'] },
      { to: '/portal/settings', label: 'Settings', icon: 'sliders' },
    ],
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function AppShell() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const merchantUser = isMerchantRole(user.role);
  const merchant = useMerchantProfile(merchantUser);
  const sections = (merchantUser ? MERCHANT_NAV : PLATFORM_NAV)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className={styles.shell}>
      <aside className={cx(styles.sidebar, menuOpen && styles.open)}>
        <div className={styles.brand}>
          <Wordmark />
          <Button
            variant="ghost"
            size="sm"
            icon={menuOpen ? 'close' : 'menu'}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className={styles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
          />
        </div>

        <div className={styles.collapsible}>
          {merchantUser && (
            <div className={styles.tenant} title={merchant.data?.legalName}>
              <span className={styles.tenantLabel}>Merchant</span>
              <span className={styles.tenantName}>{merchant.data?.tradingName ?? '…'}</span>
            </div>
          )}
          <nav className={styles.nav} aria-label="Main">
            {sections.map((section) => (
              <div key={section.label ?? 'main'} className={styles.navSection}>
                {section.label && <div className={styles.navLabel}>{section.label}</div>}
                {section.items.map((item) => (
                  <NavItemLink key={item.to} item={item} />
                ))}
              </div>
            ))}
            <div className={styles.navLabel}>Developers</div>
            <a className={styles.link} href="/api/docs" target="_blank" rel="noreferrer">
              <Icon name="book" />
              API reference
            </a>
          </nav>
        </div>

        <div className={cx(styles.footer, styles.collapsible)}>
          <ThemeSwitch />
          <div className={styles.user}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user.fullName)}
            </span>
            <Link to="/account" className={styles.userText} title="My account">
              <div className={styles.userName}>{user.fullName}</div>
              <div className={styles.userRole}>{ROLE_LABEL[user.role]}</div>
            </Link>
            <Button variant="ghost" size="sm" icon="logout" aria-label="Sign out" title="Sign out" onClick={signOut} />
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <Suspense fallback={<PageLoader label="Loading" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}
