import { useState, useCallback, useEffect } from 'react';
import { Clock } from '@/components/Clock';
import { FilterBar } from '@/components/FilterBar';
import { PunchCard } from '@/components/PunchCard';
import { PunchConfirm } from '@/components/PunchConfirm';
import { DeviceSetup } from '@/components/DeviceSetup';
import { usePunchData } from '@/hooks/usePunchData';
import { useDemoData } from '@/hooks/useDemoData';
import { isDeviceRegistered } from '@/lib/api';
import type { EmployeeWithStatus, FilterType } from '@/lib/types';
import styles from './App.module.css';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export function App() {
  const [registered, setRegistered] = useState(IS_DEMO || isDeviceRegistered());

  useEffect(() => {
    // トークン失効時（サーバーが 401 を返した時）は再登録画面へ戻す
    const onUnauthorized = () => setRegistered(false);
    window.addEventListener('punch-device-unauthorized', onUnauthorized);
    return () => window.removeEventListener('punch-device-unauthorized', onUnauthorized);
  }, []);

  if (!registered) {
    return <DeviceSetup onRegistered={() => setRegistered(true)} />;
  }

  return <PunchBoard />;
}

function PunchBoard() {
  const live = usePunchData();
  const demo = useDemoData();
  const { employees, loading, online, punch, cancelLastPunch } = IS_DEMO ? demo : live;
  const [filter, setFilter] = useState<FilterType>('全員');
  const [selected, setSelected] = useState<EmployeeWithStatus | null>(null);
  const [processing, setProcessing] = useState(false);

  const filtered =
    filter === '全員' ? employees : employees.filter((e) => e.employeeType === filter);

  const handleTap = useCallback((emp: EmployeeWithStatus) => {
    setSelected(emp);
  }, []);

  const handleConfirm = useCallback(
    async (type: 'clock_in' | 'clock_out') => {
      if (!selected) return;
      setProcessing(true);
      try {
        await punch(selected.id, selected.name, type);
        setSelected(null);
      } catch (err) {
        alert(`打刻に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
      } finally {
        setProcessing(false);
      }
    },
    [selected, punch],
  );

  const handleUndo = useCallback(async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await cancelLastPunch(selected.id);
      setSelected(null);
    } catch (err) {
      alert(`取消に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setProcessing(false);
    }
  }, [selected, cancelLastPunch]);

  return (
    <div className={styles.app}>
      <Clock online={online} />
      <FilterBar current={filter} onChange={setFilter} />

      {loading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>従業員が登録されていません</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((emp) => (
            <PunchCard key={emp.id} employee={emp} onTap={handleTap} />
          ))}
        </div>
      )}

      {selected && (
        <PunchConfirm
          employee={selected}
          onConfirm={handleConfirm}
          onCancel={() => setSelected(null)}
          onUndoLast={handleUndo}
          processing={processing}
        />
      )}
    </div>
  );
}
