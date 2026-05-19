/**
 * 勤怠データバリデーション
 *
 * 月次の勤怠データに対して各種チェックを実行し、
 * 警告リストを返す。
 */

import type { AttendanceWarning } from '../../shared/types';

interface AttendanceRow {
  employeeId: number;
  employeeName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workMinutes: number;
  isHoliday: boolean;
}

interface ValidationConfig {
  monthlyOvertimeLimitMinutes: number;
  maxDailyWorkMinutes: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  monthlyOvertimeLimitMinutes: 45 * 60,
  maxDailyWorkMinutes: 16 * 60,
};

export function validateAttendance(
  records: AttendanceRow[],
  config: ValidationConfig = DEFAULT_CONFIG,
): AttendanceWarning[] {
  const warnings: AttendanceWarning[] = [];

  for (const r of records) {
    if (r.clockIn && !r.clockOut) {
      warnings.push({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        date: r.date,
        type: 'missing_clock_out',
        message: `${r.employeeName}: ${r.date} の退勤打刻がありません`,
      });
    }

    if (!r.clockIn && r.clockOut) {
      warnings.push({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        date: r.date,
        type: 'missing_clock_in',
        message: `${r.employeeName}: ${r.date} の出勤打刻がありません`,
      });
    }

    if (r.clockIn && r.clockOut) {
      const inTime = new Date(r.clockIn).getTime();
      const outTime = new Date(r.clockOut).getTime();

      if (outTime < inTime) {
        warnings.push({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          type: 'abnormal_hours',
          message: `${r.employeeName}: ${r.date} の退勤時刻が出勤時刻より前です`,
        });
      }

      if (r.workMinutes > config.maxDailyWorkMinutes) {
        const hours = (r.workMinutes / 60).toFixed(1);
        warnings.push({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          date: r.date,
          type: 'abnormal_hours',
          message: `${r.employeeName}: ${r.date} の勤務時間が${hours}時間と異常です`,
        });
      }
    }

    if (r.isHoliday && r.clockIn) {
      warnings.push({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        date: r.date,
        type: 'holiday_work',
        message: `${r.employeeName}: ${r.date} は休日ですが出勤しています（休日割増対象）`,
      });
    }
  }

  const byEmployee = new Map<number, AttendanceRow[]>();
  for (const r of records) {
    const arr = byEmployee.get(r.employeeId) ?? [];
    arr.push(r);
    byEmployee.set(r.employeeId, arr);
  }

  for (const [employeeId, empRecords] of byEmployee) {
    const totalOvertimeMinutes = empRecords.reduce(
      (sum, r) => sum + Math.max(0, r.workMinutes - 480),
      0,
    );

    if (totalOvertimeMinutes > config.monthlyOvertimeLimitMinutes) {
      const hours = (totalOvertimeMinutes / 60).toFixed(1);
      const name = empRecords[0]?.employeeName ?? '';
      warnings.push({
        employeeId,
        employeeName: name,
        date: '',
        type: 'overtime_excess',
        message: `${name}: 月間残業時間が${hours}時間で36協定上限（${config.monthlyOvertimeLimitMinutes / 60}時間）を超過しています`,
      });
    }
  }

  return warnings;
}
