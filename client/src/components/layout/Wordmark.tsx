import { Link } from 'react-router-dom';
import styles from './Wordmark.module.css';

export function Wordmark() {
  return (
    <Link to="/" className={styles.wordmark} aria-label="Merchant Desk home">
      <svg className={styles.glyph} width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" />
        <path d="M9 21.5V10.5l7 6.2 7-6.2v11" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Merchant Desk
    </Link>
  );
}
