import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  placeholder: string;
  label: string;
  onSearch(value: string): void;
}

// Searches as you type (debounced), so lists filter without an Apply button.
export function SearchField({ value, placeholder, label, onSearch }: SearchFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  return (
    <label className={styles.search}>
      <Icon name="search" className={styles.icon} />
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        className={styles.input}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  );
}
