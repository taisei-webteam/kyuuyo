import { useState, useCallback, type FormEvent } from 'react';
import { registerDevice } from '@/lib/api';
import styles from './DeviceSetup.module.css';

/**
 * 端末登録画面。管理パスワードで一度だけ登録すると、以降この端末で打刻できる。
 */
export function DeviceSetup({ onRegistered }: { onRegistered: () => void }) {
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setError(null);
      setSubmitting(true);
      try {
        await registerDevice(password, label.trim());
        onRegistered();
      } catch (err) {
        setError(err instanceof Error ? err.message : '登録に失敗しました');
      } finally {
        setSubmitting(false);
      }
    },
    [password, label, submitting, onRegistered],
  );

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>端末の登録</h1>
        <p className={styles.desc}>
          この端末で打刻を行うには、管理者による登録が必要です。
          管理パスワードを入力してください。登録は最初の一度だけです。
        </p>

        <label className={styles.field}>
          <span className={styles.label}>端末名（任意）</span>
          <input
            className={styles.input}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例：事務所iPad"
            autoComplete="off"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>管理パスワード</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理パスワード"
            autoComplete="off"
            required
          />
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.button} type="submit" disabled={submitting || !password}>
          {submitting ? '登録中...' : 'この端末を登録する'}
        </button>
      </form>
    </div>
  );
}
