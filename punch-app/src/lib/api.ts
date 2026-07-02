const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const DEVICE_TOKEN_KEY = 'punch_device_token';

/** この端末に保存されたデバイストークンを取得する（未登録なら null）。 */
export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    // localStorage 不可環境では登録を維持できない
  }
}

function clearDeviceToken(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    // no-op
  }
}

/** この端末が登録済みか。 */
export function isDeviceRegistered(): boolean {
  return getDeviceToken() !== null;
}

export type PunchType = 'clock_in' | 'clock_out' | 'go_out' | 'go_return';

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
  punch_type: PunchType;
  punched_at: string;
  device: 'ipad' | 'manual';
  cancelled: boolean;
  created_at: string;
}

interface ApiErrorResponse {
  error?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDeviceToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-device-token': token } : {}),
      ...init?.headers,
    },
  });

  // 端末が未登録・失効している場合はトークンを破棄し、再登録を促す
  if (res.status === 401) {
    clearDeviceToken();
    window.dispatchEvent(new Event('punch-device-unauthorized'));
    const body = (await res.json().catch((): ApiErrorResponse => ({}))) as ApiErrorResponse;
    throw new Error(body.error ?? 'この端末は打刻を許可されていません');
  }

  if (!res.ok) {
    const body = await res.json().catch((): ApiErrorResponse => ({})) as ApiErrorResponse;
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * 管理パスワードでこの端末を登録し、発行されたデバイストークンを保存する。
 */
export async function registerDevice(password: string, label: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, label }),
  });

  const body = (await res.json().catch((): ApiErrorResponse => ({}))) as ApiErrorResponse & {
    token?: string;
  };

  if (!res.ok || !body.token) {
    throw new Error(body.error ?? `登録に失敗しました (${res.status})`);
  }

  setDeviceToken(body.token);
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
  punchType: PunchType,
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
