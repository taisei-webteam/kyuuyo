import type { EmployeeWithStatus } from '@/lib/types';
import styles from './PunchConfirm.module.css';

interface Props {
  employee: EmployeeWithStatus;
  onConfirm: (type: 'clock_in' | 'clock_out') => void;
  onCancel: () => void;
  onUndoLast: () => void;
  processing: boolean;
}

export function PunchConfirm({ employee, onConfirm, onCancel, onUndoLast, processing }: Props) {
  const { name, status, clockInTime } = employee;
  const nextAction = status === 'clocked_in' ? 'clock_out' : 'clock_in';
  const actionLabel = nextAction === 'clock_in' ? '出勤' : '退勤';
  const canUndo = status !== 'idle';

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.employeeName}>{name}</div>

        {status === 'clocked_out' ? (
          <>
            <p className={styles.message}>
              本日は既に退勤済みです（{clockInTime}〜{employee.clockOutTime}）
            </p>
            <div className={styles.actions}>
              {canUndo && (
                <button className={styles.undoBtn} onClick={onUndoLast} disabled={processing}>
                  直近の打刻を取消
                </button>
              )}
              <button className={styles.cancelBtn} onClick={onCancel}>
                閉じる
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.message}>
              {actionLabel}しますか？
              {status === 'clocked_in' && clockInTime && (
                <span className={styles.sub}>（出勤: {clockInTime}）</span>
              )}
            </p>
            <div className={styles.actions}>
              <button
                className={nextAction === 'clock_in' ? styles.clockInBtn : styles.clockOutBtn}
                onClick={() => onConfirm(nextAction)}
                disabled={processing}
              >
                {processing ? '処理中...' : `${actionLabel}する`}
              </button>
              {canUndo && (
                <button className={styles.undoBtn} onClick={onUndoLast} disabled={processing}>
                  直近の打刻を取消
                </button>
              )}
              <button className={styles.cancelBtn} onClick={onCancel} disabled={processing}>
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
