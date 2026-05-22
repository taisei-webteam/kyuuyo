import { useState, useEffect } from 'react';
import styles from './Clock.module.css';

function formatDate(d: Date): string {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()]!;
  return `${y}年${m}月${day}日（${w}）`;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function Clock({ online }: { online: boolean }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>らくらく給与明細α</h1>
        {!online && <span className={styles.offlineBadge}>オフライン</span>}
      </div>
      <div className={styles.date}>{formatDate(now)}</div>
      <div className={styles.time}>{formatTime(now)}</div>
    </header>
  );
}
