import type { EmployeeWithStatus } from './types';

export const DEMO_EMPLOYEES: EmployeeWithStatus[] = [
  { id: 2, name: '田中 好徳', nameKana: 'タナカ ヨシノリ', employeeType: '社員', displayOrder: 2, status: 'clocked_in', clockInTime: '8:30', clockOutTime: null },
  { id: 3, name: '有馬 優子', nameKana: 'アリマ ユウコ', employeeType: '社員', displayOrder: 3, status: 'idle', clockInTime: null, clockOutTime: null },
  { id: 4, name: '銭花 貴文', nameKana: 'ゼニハナ タカフミ', employeeType: '社員', displayOrder: 4, status: 'clocked_in', clockInTime: '8:25', clockOutTime: null },
  { id: 5, name: '小田原 嘉秀', nameKana: 'オダワラ ヨシヒデ', employeeType: '社員', displayOrder: 5, status: 'clocked_out', clockInTime: '8:30', clockOutTime: '17:35' },
  { id: 6, name: '野口 工', nameKana: 'ノグチ タクミ', employeeType: 'パート', displayOrder: 6, status: 'idle', clockInTime: null, clockOutTime: null },
  { id: 7, name: '鬼丸 和久', nameKana: 'オニマル カズヒサ', employeeType: 'パート', displayOrder: 7, status: 'idle', clockInTime: null, clockOutTime: null },
  { id: 8, name: '安松 久弘', nameKana: 'ヤスマツ ヒサヒロ', employeeType: 'パート', displayOrder: 8, status: 'clocked_in', clockInTime: '9:00', clockOutTime: null },
];
