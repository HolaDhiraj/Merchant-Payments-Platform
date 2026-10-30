import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/api/types';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { ROLE_LABEL } from '@/lib/labels';
import { ThemeSwitch } from './ThemeSwitch';
import { Wordmark } from './Wordmark';
import styles from './AppShell.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles?: Role[];
}

const WORK_NAV: NavItem[] = [{ to: '/applications', label: 'Applications', icon: 'file' }];
const ADMIN_NAV: NavItem[] = [
  { to: '/audit', label: 'Audit log', icon: 'log', roles: ['ADMIN'] },
  { to: '/team', label: 'Team', icon: 'users', roles: ['ADMIN'] },
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

  const adminItems = ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(user.role));

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
          <nav className={styles.nav} aria-label="Main">
            {WORK_NAV.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
            {adminItems.length > 0 && (
              <>
                <div className={styles.navLabel}>Administration</div>
                {adminItems.map((item) => (
                  <NavItemLink key={item.to} item={item} />
                ))}
              </>
            )}
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
            <div className={styles.userText}>
              <div className={styles.userName} title={user.email}>
                {user.fullName}
              </div>
              <div className={styles.userRole}>{ROLE_LABEL[user.role]}</div>
            </div>
            <Button variant="ghost" size="sm" icon="logout" aria-label="Sign out" title="Sign out" onClick={signOut} />
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}
