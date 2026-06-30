const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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

interface ApiErrorResponse {
  error?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch((): ApiErrorResponse => ({})) as ApiErrorResponse;
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchEmployees(): Promise<EmployeeSync[]> {
  const data = await requestJson<{ employees: EmployeeSync[] }>('/api/employees');
  return data.employees;
}

export async function fetchPunches(start: string, end: string): Promise<PunchRecord[]> {
  const params = new URLSearchParams({ start, end });
  const data = await requestJson<{ punches: PunchRecord[] }>(`/api/punches?${params.toString()}`);
  return data.punches;
}

export async function createPunch(
  employeeId: number,
  employeeName: string,
  punchType: 'clock_in' | 'clock_out',
  punchedAt?: string,
): Promise<void> {
  await requestJson<{ punch: PunchRecord | null }>('/api/punches', {
    method: 'POST',
    body: JSON.stringify({ employeeId, employeeName, punchType, punchedAt }),
  });
}

export async function cancelLastPunch(
  employeeId: number,
  start: string,
  end: string,
  punchId?: string,
): Promise<void> {
  await requestJson<{ punch: PunchRecord | null }>('/api/punches/cancel', {
    method: 'POST',
    body: JSON.stringify({ employeeId, start, end, punchId }),
  });
}
