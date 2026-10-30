import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme, type ThemePreference } from '@/lib/theme';
import styles from './ThemeSwitch.module.css';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: IconName }> = [
  { value: 'light', label: 'Light theme', icon: 'sun' },
  { value: 'system', label: 'Match system theme', icon: 'monitor' },
  { value: 'dark', label: 'Dark theme', icon: 'moon' },
];

export function ThemeSwitch() {
  const { preference, choose } = useTheme();
  return (
    <div className={styles.switch} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          aria-label={option.label}
          title={option.label}
          className={styles.option}
          onClick={() => choose(option.value)}
        >
          <Icon name={option.icon} size={14} />
        </button>
      ))}
    </div>
  );
}
