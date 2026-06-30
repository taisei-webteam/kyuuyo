export interface EmployeeSync {
  id: number;
  name: string;
  name_kana: string | null;
  employee_type: '社員' | '役員' | 'パート';
  display_order: number;
  is_active: boolean;
}

export interface PunchRecord {
  id: string;
  employee_id: number;
  employee_name: string;
  punch_type: 'clock_in' | 'clock_out';
  punched_at: string;
  device: 'ipad' | 'manual';
  cancelled: boolean;
  created_at: string;
}

export interface PunchCreateBody {
  employeeId: number;
  employeeName: string;
  punchType: 'clock_in' | 'clock_out';
  punchedAt?: string;
}

export interface PunchCancelBody {
  punchId?: string;
  employeeId: number;
  start: string;
  end: string;
}
