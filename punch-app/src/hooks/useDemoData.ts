import { useState, useCallback } from 'react';
import { DEMO_EMPLOYEES } from '@/lib/demo-data';
import type { PunchType } from '@/lib/api';
import type { EmployeeWithStatus } from '@/lib/types';

function formatTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useDemoData() {
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>(DEMO_EMPLOYEES);

  const punch = useCallback(
    async (employeeId: number, _employeeName: string, type: PunchType) => {
      const now = formatTime(new Date());
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== employeeId) return emp;
          if (type === 'clock_in') {
            return { ...emp, status: 'clocked_in', clockInTime: now, clockOutTime: null };
          }
          if (type === 'clock_out') {
            return { ...emp, status: 'clocked_out', clockOutTime: now };
          }
          return emp;
        }),
      );
    },
    [],
  );

  const cancelLastPunch = useCallback(async (employeeId: number) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        if (emp.status === 'clocked_out') {
          return { ...emp, status: 'clocked_in', clockOutTime: null };
        }
        if (emp.status === 'clocked_in') {
          return { ...emp, status: 'idle', clockInTime: null, clockOutTime: null };
        }
        return emp;
      }),
    );
  }, []);

  const refresh = useCallback(async () => {}, []);

  return {
    employees,
    loading: false,
    online: true,
    punch,
    cancelLastPunch,
    refresh,
  };
}
