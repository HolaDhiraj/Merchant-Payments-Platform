import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/features/applications/Badges';
import styles from './BrandPreview.module.css';

const STEPS = ['Draft', 'Submitted', 'Risk check', 'Review', 'Decision'];

// Decorative product preview for the sign-in page: an application mid-review,
// drawn with the app's own badges so it always matches the current theme.
export function BrandPreview() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <div className={`${styles.card} ${styles.behind}`}>
        <div className={styles.row}>
          <span className={styles.avatar}>CC</span>
          <span className={styles.name}>Corner Coffee</span>
          <StatusBadge status="APPROVED" />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.avatar}>HB</span>
          <span className={styles.identity}>
            <span className={styles.name}>Harbor Street Bakery</span>
            <span className={styles.sub}>LLC · In person and online</span>
          </span>
          <StatusBadge status="UNDER_REVIEW" />
        </div>

        <div className={styles.risk}>
          <div className={styles.score}>
            <span className={styles.scoreValue}>18</span>
            <span className={styles.scoreMax}>/ 100</span>
            <Badge tone="success">Low risk</Badge>
          </div>
          <div className={styles.meter}>
            <span className={styles.meterFill} />
          </div>
        </div>

        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step} className={index < 3 ? styles.done : index === 3 ? styles.current : undefined}>
              {step}
            </li>
          ))}
        </ol>

        <div className={styles.foot}>
          <span>Monthly volume</span>
          <span className="mono">$48,000.00</span>
        </div>
      </div>
    </div>
  );
}
