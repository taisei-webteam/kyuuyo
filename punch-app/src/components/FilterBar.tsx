import type { FilterType } from '@/lib/types';
import styles from './FilterBar.module.css';

const filters: FilterType[] = ['全員', '社員', 'パート'];

interface Props {
  current: FilterType;
  onChange: (f: FilterType) => void;
}

export function FilterBar({ current, onChange }: Props) {
  return (
    <div className={styles.bar}>
      {filters.map((f) => (
        <button
          key={f}
          className={`${styles.btn} ${f === current ? styles.active : ''}`}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
