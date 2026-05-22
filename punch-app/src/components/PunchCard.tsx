import type { EmployeeWithStatus } from '@/lib/types';
import styles from './PunchCard.module.css';

interface Props {
  employee: EmployeeWithStatus;
  onTap: (employee: EmployeeWithStatus) => void;
}

export function PunchCard({ employee, onTap }: Props) {
  const { name, status, clockInTime, clockOutTime } = employee;

  const statusClass =
    status === 'clocked_in'
      ? styles.cardActive
      : status === 'clocked_out'
        ? styles.cardDone
        : styles.cardIdle;

  const nameParts = name.split(/\s+/);
  const lastName = nameParts[0] ?? name;
  const firstName = nameParts.slice(1).join(' ');

  return (
    <button className={`${styles.card} ${statusClass}`} onClick={() => onTap(employee)}>
      <div className={styles.name}>
        <span className={styles.lastName}>{lastName}</span>
        {firstName && <span className={styles.firstName}>{firstName}</span>}
      </div>
      {status === 'clocked_in' && (
        <div className={styles.status}>
          <span className={styles.statusLabel}>出勤</span>
          <span className={styles.statusTime}>{clockInTime}</span>
        </div>
      )}
      {status === 'clocked_out' && (
        <div className={styles.status}>
          <span className={styles.statusTime}>
            {clockInTime}〜{clockOutTime}
          </span>
        </div>
      )}
    </button>
  );
}
