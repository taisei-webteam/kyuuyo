export type PunchStatus = 'idle' | 'clocked_in' | 'clocked_out';

export interface EmployeeWithStatus {
  id: number;
  name: string;
  nameKana: string | null;
  employeeType: '社員' | '役員' | 'パート';
  displayOrder: number;
  status: PunchStatus;
  clockInTime: string | null;
  clockOutTime: string | null;
}

export type FilterType = '全員' | '社員' | 'パート';
