import { useState, useEffect, useCallback } from 'react';
import {
  cancelLastPunch as cancelLastPunchApi,
  createPunch,
  fetchEmployees,
  fetchPunches,
  type PunchRecord,
  type PunchType,
} from '@/lib/api';
import type { EmployeeWithStatus, PunchStatus } from '@/lib/types';

function todayRange(): { start: string; end: string } {
  // 当日の範囲は「端末ローカル(JST)の0:00〜23:59」を UTC の絶対時刻に変換して返す。
  // punch_records.punched_at は UTC 保存で、API 側は timestamptz(=UTC)で比較するため、
  // タイムゾーン無しの文字列で送ると UTC の0時基準になり、朝(JST)の出勤打刻が
  // 前日UTC扱いで範囲から漏れ「退勤したのに未出勤」になる不具合が起きる。
  const now = new Date();
  const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    start: startLocal.toISOString(),
    end: endLocal.toISOString(),
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function deriveStatus(
  punches: PunchRecord[],
): { status: PunchStatus; clockInTime: string | null; clockOutTime: string | null } {
  const active = punches
    .filter((p) => !p.cancelled)
    .sort((a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime());

  const lastIn = active.filter((p) => p.punch_type === 'clock_in').at(-1);
  const lastOut = active.filter((p) => p.punch_type === 'clock_out').at(-1);

  if (!lastIn) return { status: 'idle', clockInTime: null, clockOutTime: null };
  if (!lastOut || new Date(lastIn.punched_at) > new Date(lastOut.punched_at)) {
    return { status: 'clocked_in', clockInTime: formatTime(lastIn.punched_at), clockOutTime: null };
  }
  return {
    status: 'clocked_out',
    clockInTime: formatTime(lastIn.punched_at),
    clockOutTime: formatTime(lastOut.punched_at),
  };
}

export function usePunchData() {
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  const fetchData = useCallback(async () => {
    const { start, end } = todayRange();

    const [emps, punches] = await Promise.all([
      fetchEmployees(),
      fetchPunches(start, end),
    ]);

    const mapped: EmployeeWithStatus[] = emps.map((emp) => {
      const empPunches = punches.filter((p) => p.employee_id === emp.id);
      const { status, clockInTime, clockOutTime } = deriveStatus(empPunches);
      return {
        id: emp.id,
        name: emp.name,
        nameKana: emp.name_kana,
        employeeType: emp.employee_type,
        displayOrder: emp.display_order,
        status,
        clockInTime,
        clockOutTime,
      };
    });

    setEmployees(mapped);
    setLoading(false);
  }, []);

  const punch = useCallback(
    async (employeeId: number, employeeName: string, type: PunchType) => {
      await createPunch(employeeId, employeeName, type);
      await fetchData();
    },
    [fetchData],
  );

  const cancelLastPunch = useCallback(
    async (employeeId: number) => {
      const { start, end } = todayRange();
      await cancelLastPunchApi(employeeId, start, end);
      await fetchData();
    },
    [fetchData],
  );

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [fetchData]);

  return { employees, loading, online, punch, cancelLastPunch, refresh: fetchData };
}
