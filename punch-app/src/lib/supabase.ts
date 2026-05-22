import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase の環境変数が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

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
