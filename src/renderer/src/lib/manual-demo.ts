import type { HolidayMode } from '../../../shared/types'
import { setEmployees, type MockEmployee } from './mock-data'
import { updateSettings } from './settings-store'

/**
 * マニュアル撮影用の架空従業員。本番の SQLite には書かない。
 * 起動: npm run dev:manual （ブラウザで ?manual=1）
 * 通常の開発データに戻すときは ?manual=0 を開く。
 */

interface Seed {
  name: string
  kana: string
  type: MockEmployee['employeeType']
  dept: string
  title: string
  birth: string
  hire: string
  pay: number
  resign?: string
  transport?: number
  taxableTransport?: number
  position?: number
  family?: number
  sales?: number
  health?: number
  pension?: number
  standard?: number
  tax?: number
  savings?: number
  dependents?: number
  start?: string
  end?: string
  holidays?: number[]
  holidayMode?: HolidayMode
  earlyStart?: string
  earlyEnd?: string
  overtime?: boolean
  fixedOt?: number
  bonus?: boolean
  leave?: number
}

const ROSTER: Seed[] = [
  { name: '青葉 健一', kana: 'アオバ ケンイチ', type: '役員', dept: '総務', title: '代表取締役', birth: '1968-04-12', hire: '2008-04-01', pay: 500000, health: 24000, pension: 45000, tax: 32000, dependents: 2, leave: 20, overtime: false },
  { name: '青葉 美咲', kana: 'アオバ ミサキ', type: '役員', dept: '総務', title: '取締役', birth: '1972-11-03', hire: '2012-04-01', pay: 380000, health: 18000, pension: 34000, tax: 18000, dependents: 1, leave: 16, overtime: false },
  { name: '黒川 正', kana: 'クロカワ タダシ', type: '役員', dept: '製造', title: '専務取締役', birth: '1964-01-20', hire: '2008-04-01', pay: 520000, health: 26000, pension: 48000, tax: 42000, dependents: 1, leave: 18, overtime: false },
  { name: '白石 恵', kana: 'シライシ メグミ', type: '役員', dept: '営業', title: '常務取締役', birth: '1970-06-15', hire: '2010-06-01', pay: 480000, health: 24000, pension: 44000, tax: 32000, dependents: 0, leave: 16, overtime: false },
  { name: '森下 浩', kana: 'モリシタ ヒロシ', type: '役員', dept: '製造', title: '取締役', birth: '1976-09-08', hire: '2015-04-01', pay: 420000, health: 20000, pension: 38000, tax: 22000, dependents: 2, leave: 14, overtime: false },
  { name: '西村 陽子', kana: 'ニシムラ ヨウコ', type: '役員', dept: '総務', title: '監査役', birth: '1979-02-28', hire: '2018-04-01', pay: 300000, health: 15000, pension: 27000, tax: 8000, dependents: 0, leave: 12, overtime: false, bonus: false },

  { name: '佐藤 大輔', kana: 'サトウ ダイスケ', type: '社員', dept: '製造', title: '製造係長', birth: '1982-03-18', hire: '2010-04-01', pay: 280000, transport: 10000, position: 20000, health: 15000, pension: 27000, tax: 8000, savings: 5000, dependents: 2, leave: 14, earlyStart: '07:00', earlyEnd: '08:00' },
  { name: '鈴木 真由', kana: 'スズキ マユ', type: '社員', dept: '総務', title: '総務主任', birth: '1988-07-22', hire: '2014-04-01', pay: 250000, transport: 8000, position: 10000, family: 10000, health: 14000, pension: 25000, tax: 6000, dependents: 1, leave: 12 },
  { name: '高橋 翔', kana: 'タカハシ ショウ', type: '社員', dept: '営業', title: '営業', birth: '1992-12-05', hire: '2016-04-01', pay: 270000, transport: 12000, sales: 15000, health: 15000, pension: 26000, tax: 9000, dependents: 0, leave: 10 },
  { name: '田中 彩', kana: 'タナカ アヤ', type: '社員', dept: '総務', title: '経理', birth: '1996-05-30', hire: '2019-04-01', pay: 230000, transport: 6000, health: 13000, pension: 23000, tax: 4000, dependents: 0, leave: 11, overtime: false },
  { name: '伊藤 蓮', kana: 'イトウ レン', type: '社員', dept: '製造', title: '製造', birth: '1994-08-14', hire: '2017-10-01', pay: 240000, transport: 10000, family: 5000, health: 13000, pension: 24000, tax: 5000, dependents: 1, leave: 8 },
  { name: '渡辺 直樹', kana: 'ワタナベ ナオキ', type: '社員', dept: '配送', title: '配送', birth: '1985-01-09', hire: '2013-04-01', pay: 260000, transport: 15000, health: 14000, pension: 25000, tax: 7000, dependents: 2, leave: 15 },
  { name: '山本 結衣', kana: 'ヤマモト ユイ', type: '社員', dept: '営業', title: '営業', birth: '1998-10-21', hire: '2021-04-01', pay: 245000, transport: 8000, sales: 10000, health: 13000, pension: 24000, tax: 5000, dependents: 1, leave: 9 },
  { name: '中村 海斗', kana: 'ナカムラ カイト', type: '社員', dept: '製造', title: '製造', birth: '1990-02-11', hire: '2015-04-01', pay: 255000, transport: 10000, health: 14000, pension: 25000, tax: 12000, dependents: 0, leave: 13, fixedOt: 30000, holidayMode: 'individual', holidays: [0, 6] },
  { name: '小林 凛', kana: 'コバヤシ リン', type: '社員', dept: '配送', title: '配送', birth: '1993-06-02', hire: '2018-09-01', pay: 220000, transport: 25000, taxableTransport: 5000, health: 12000, pension: 22000, tax: 3000, dependents: 0, leave: 7 },

  { name: '加藤 茜', kana: 'カトウ アカネ', type: 'パート', dept: '製造', title: '製造', birth: '1986-04-04', hire: '2020-04-01', pay: 1250, start: '08:00', end: '16:00', transport: 5000, health: 8000, pension: 16000, standard: 160000, tax: 2000, dependents: 1, leave: 8 },
  { name: '吉田 蓮', kana: 'ヨシダ レン', type: 'パート', dept: '製造', title: '製造', birth: '1991-09-19', hire: '2021-06-01', pay: 1200, start: '08:00', end: '16:00', transport: 4000, health: 7500, pension: 15000, standard: 150000, dependents: 0, leave: 6 },
  { name: '山田 桜', kana: 'ヤマダ サクラ', type: 'パート', dept: '営業', title: '事務', birth: '1984-12-25', hire: '2019-09-01', pay: 1300, start: '09:00', end: '17:00', transport: 6000, health: 9000, pension: 18000, standard: 180000, tax: 3000, dependents: 2, leave: 10 },
  { name: '松本 悠', kana: 'マツモト ハルカ', type: 'パート', dept: '配送', title: '配送', birth: '1995-03-07', hire: '2022-04-01', pay: 1180, start: '08:00', end: '15:00', transport: 8000, health: 7000, pension: 14000, standard: 140000, dependents: 0, leave: 5 },
  { name: '井上 葵', kana: 'イノウエ アオイ', type: 'パート', dept: '総務', title: '総務', birth: '1989-08-16', hire: '2020-10-01', pay: 1220, start: '09:00', end: '16:00', transport: 3000, health: 8000, pension: 16000, standard: 160000, tax: 1000, dependents: 1, leave: 7 },
  { name: '木村 湊', kana: 'キムラ ミナト', type: 'パート', dept: '製造', title: '製造', birth: '2001-01-13', hire: '2023-04-01', pay: 1100, start: '09:00', end: '14:00', transport: 2000, leave: 4 },
  { name: '林 凪', kana: 'ハヤシ ナギ', type: 'パート', dept: '製造', title: '製造', birth: '2003-07-29', hire: '2024-04-01', pay: 1150, start: '10:00', end: '15:00', transport: 3000, leave: 3 },
  { name: '斎藤 陽菜', kana: 'サイトウ ヒナ', type: 'パート', dept: '営業', title: '事務', birth: '1999-11-08', hire: '2022-09-01', pay: 1200, start: '10:00', end: '16:00', transport: 4000, leave: 5 },
  { name: '清水 碧', kana: 'シミズ ミドリ', type: 'パート', dept: '総務', title: '総務', birth: '1978-05-17', hire: '2019-04-01', pay: 1100, start: '13:00', end: '17:00', transport: 2000, leave: 6 },
  { name: '山口 颯', kana: 'ヤマグチ ハヤテ', type: 'パート', dept: '配送', title: '配送', birth: '2000-02-02', hire: '2023-10-01', pay: 1050, start: '08:00', end: '12:00', transport: 3000, leave: 2 },
  { name: '池田 紬', kana: 'イケダ ツムギ', type: 'パート', dept: '製造', title: '製造', birth: '1997-06-26', hire: '2021-04-01', pay: 1100, start: '09:00', end: '13:00', transport: 2000, leave: 4 },
  { name: '橋本 朝陽', kana: 'ハシモト アサヒ', type: 'パート', dept: '営業', title: '営業補助', birth: '2002-10-10', hire: '2024-06-01', pay: 1150, start: '11:00', end: '16:00', transport: 4000, leave: 3 },
  { name: '阿部 結', kana: 'アベ ユイ', type: 'パート', dept: '総務', title: '総務', birth: '1993-04-23', hire: '2020-04-01', pay: 1200, start: '09:00', end: '15:00', transport: 3000, dependents: 1, leave: 6 },
  { name: '石川 律', kana: 'イシカワ リツ', type: 'パート', dept: '配送', title: '配送', birth: '1987-12-01', hire: '2022-01-06', pay: 1250, start: '13:00', end: '18:00', transport: 5000, leave: 5 },
  { name: '前田 春', kana: 'マエダ ハル', type: 'パート', dept: '製造', title: '製造', birth: '1994-03-15', hire: '2021-04-01', resign: '2026-08-31', pay: 1100, start: '09:00', end: '13:00', transport: 2000, leave: 1 },
]

function buildRoster(seeds: Seed[]): MockEmployee[] {
  return seeds.map((seed, index): MockEmployee => {
    const part = seed.type === 'パート'
    const officer = seed.type === '役員'
    return {
      id: index + 1,
      name: seed.name,
      nameKana: seed.kana,
      email: `demo${String(index + 1).padStart(2, '0')}@example.co.jp`,
      birthDate: seed.birth,
      employeeType: seed.type,
      departmentName: seed.dept,
      jobTitle: seed.title,
      hireDate: seed.hire,
      resignDate: seed.resign ?? null,
      displayOrder: index + 1,
      basicSalary: part ? 0 : seed.pay,
      hourlyRate: part ? seed.pay : 0,
      standardMonthlyRemuneration: seed.standard ?? (part ? 0 : Math.round(seed.pay / 10000) * 10000),
      transportAllowance: officer ? 0 : (seed.transport ?? 0),
      taxableTransport: seed.taxableTransport ?? 0,
      positionAllowance: officer ? 0 : (seed.position ?? 0),
      familyAllowance: officer ? 0 : (seed.family ?? 0),
      specialAllowance: 0,
      dangerAllowance: 0,
      salesAllowance: officer ? 0 : (seed.sales ?? 0),
      healthInsurance: seed.health ?? 0,
      healthInsuranceManual: true,
      welfarePension: seed.pension ?? 0,
      residentTax: seed.tax ?? 0,
      savingsDeduction: seed.savings ?? 0,
      loanDeduction: 0,
      dependents: seed.dependents ?? 0,
      isActive: true,
      scheduledStart: seed.start ?? (part ? '09:00' : '08:00'),
      scheduledEnd: seed.end ?? (part ? '15:00' : '17:00'),
      holidayDays: seed.holidays ?? [0],
      holidayMode: seed.holidayMode ?? 'calendar',
      earlyWorkStart: seed.earlyStart ?? null,
      earlyWorkEnd: seed.earlyEnd ?? null,
      overtimeAllowed: seed.overtime ?? !part,
      overtimeStart: null,
      overtimeEnd: null,
      bonusEligible: officer ? (seed.bonus ?? true) : undefined,
      employmentInsuranceOverage: 0,
      fixedOvertimePay: officer ? 0 : (seed.fixedOt ?? 0),
      incomeTaxExempt: false,
      paidLeaveBalance: seed.leave ?? (part ? 5 : 12),
      emailVerifyStatus: 'unverified',
      emailVerifySentAt: null,
      emailVerifiedAt: null,
    }
  })
}

function assertRoster(list: MockEmployee[]): void {
  const count = (type: MockEmployee['employeeType']): number => list.filter((emp) => emp.employeeType === type).length
  if (list.length !== 30 || count('役員') !== 6 || count('社員') !== 9 || count('パート') !== 15) {
    throw new Error('マニュアル用の人数が 役員6・社員9・パート15 になっていません')
  }
}

export function applyManualDemo(): void {
  const list = buildRoster(ROSTER)
  assertRoster(list)
  setEmployees(list)
  updateSettings({
    companyName: '株式会社あおば製作所',
    representativeName: '青葉 健一',
    postalCode: '530-0001',
    address: '大阪市北区梅田1-1-1',
    phone: '06-0000-0000',
    insuranceNumber: '13-123456',
    emailSenderName: '株式会社あおば製作所',
    emailSenderAddress: 'payroll@example.co.jp',
    paidLeavePolicy: 'マニュアル撮影用の架空データです。有給残日数は手入力で管理しています。',
  })
}
