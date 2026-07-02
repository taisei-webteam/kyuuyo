import { useState, useEffect, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { MockEmployee, HolidayMode } from '@/lib/mock-data'
import { calculateInsurancePremiums, calcAge, INSURANCE_RATES, nextEmployeeId } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import { DateSelect } from './DateSelect'
import styles from './EmployeeForm.module.css'

interface EmployeeFormProps {
  employee: MockEmployee | null
  onSave: (data: MockEmployee) => void
  onClose: () => void
}

const emptyEmployee: MockEmployee = {
  id: 0,
  name: '',
  nameKana: '',
  email: '',
  birthDate: '',
  employeeType: '社員',
  departmentName: '',
  jobTitle: '',
  hireDate: '',
  resignDate: null,
  displayOrder: 0,
  basicSalary: 0,
  hourlyRate: 0,
  standardMonthlyRemuneration: 0,
  transportAllowance: 0,
  positionAllowance: 0,
  familyAllowance: 0,
  specialAllowance: 0,
  dangerAllowance: 0,
  salesAllowance: 0,
  healthInsurance: 0,
  welfarePension: 0,
  residentTax: 0,
  savingsDeduction: 0,
  loanDeduction: 0,
  dependents: 0,
  isActive: true,
  scheduledStart: '09:00',
  scheduledEnd: '18:00',
  holidayDays: [0, 6],
  holidayMode: 'calendar' as HolidayMode,
  earlyWorkStart: null,
  earlyWorkEnd: null,
  overtimeAllowed: true,
  overtimeStart: '18:00',
  overtimeEnd: '22:00',
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

export function EmployeeForm({ employee, onSave, onClose }: EmployeeFormProps): ReactElement {
  const [form, setForm] = useState<MockEmployee>(
    employee ?? { ...emptyEmployee, id: nextEmployeeId(), displayOrder: nextEmployeeId() },
  )

  useEffect(() => {
    setForm(employee ?? { ...emptyEmployee, id: nextEmployeeId(), displayOrder: nextEmployeeId() })
  }, [employee])

  const isNew = !employee

  const autoInsurance = useMemo(() => {
    if (!form.birthDate || !form.standardMonthlyRemuneration) return null
    const totalPayment = form.basicSalary + form.transportAllowance + form.positionAllowance +
      form.familyAllowance + form.specialAllowance + form.dangerAllowance + form.salesAllowance
    return calculateInsurancePremiums(form.standardMonthlyRemuneration, form.birthDate, totalPayment)
  }, [form.standardMonthlyRemuneration, form.birthDate, form.basicSalary, form.transportAllowance,
    form.positionAllowance, form.familyAllowance, form.specialAllowance, form.dangerAllowance, form.salesAllowance])

  const age = useMemo(() => {
    if (!form.birthDate) return null
    return calcAge(form.birthDate)
  }, [form.birthDate])

  function handleChange(field: keyof MockEmployee, value: string | number | boolean): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const saveData = { ...form }
    if (autoInsurance) {
      saveData.healthInsurance = autoInsurance.healthInsurance
      saveData.welfarePension = autoInsurance.welfarePension
    }
    onSave(saveData)
  }

  const overlay = useOverlayDismiss(onClose)

  return (
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{isNew ? '従業員 新規登録' : '従業員 編集'}</h2>
          <button className={styles.closeButton} onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>個人情報</div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>氏名</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="例: 田中 太郎"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>フリガナ</label>
                  <input
                    type="text"
                    value={form.nameKana}
                    onChange={(e) => handleChange('nameKana', e.target.value)}
                    placeholder="例: タナカ タロウ"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>メールアドレス</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="例: tanaka@example.co.jp"
                  />
                </div>
                <div className={styles.field}>
                  <label>生年月日 {age !== null && <span className={styles.ageBadge}>({age}歳)</span>}</label>
                  <DateSelect
                    value={form.birthDate}
                    onChange={(value) => handleChange('birthDate', value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>社員区分</label>
                  <select
                    value={form.employeeType}
                    onChange={(e) => handleChange('employeeType', e.target.value)}
                  >
                    <option value="社員">社員</option>
                    <option value="役員">役員</option>
                    <option value="パート">パート</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>部署名</label>
                  <input
                    type="text"
                    value={form.departmentName}
                    onChange={(e) => handleChange('departmentName', e.target.value)}
                    placeholder="例: 営業部"
                  />
                </div>
                <div className={styles.field}>
                  <label>職名</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => handleChange('jobTitle', e.target.value)}
                    placeholder="例: 部長"
                  />
                </div>
                <div className={styles.field}>
                  <label>雇入年月日</label>
                  <DateSelect
                    value={form.hireDate}
                    onChange={(value) => handleChange('hireDate', value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>退職年月日（在籍中は空欄）</label>
                  <DateSelect
                    value={form.resignDate ?? ''}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, resignDate: value || null }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>表示順</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => handleChange('displayOrder', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>定時（開始）</label>
                  <input
                    type="time"
                    value={form.scheduledStart}
                    onChange={(e) => handleChange('scheduledStart', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>定時（終了）</label>
                  <input
                    type="time"
                    value={form.scheduledEnd}
                    onChange={(e) => handleChange('scheduledEnd', e.target.value)}
                  />
                </div>
                <div className={styles.timePair}>
                  <div className={styles.field}>
                    <label>早出開始時刻</label>
                    <input
                      type="time"
                      value={form.earlyWorkStart ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          earlyWorkStart: e.target.value || null,
                        }))
                      }
                      placeholder="未設定"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>早出終了時刻</label>
                    <input
                      type="time"
                      value={form.earlyWorkEnd ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          earlyWorkEnd: e.target.value || null,
                        }))
                      }
                      placeholder="未設定"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={!form.overtimeAllowed}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeAllowed: !e.target.checked,
                          overtimeStart: e.target.checked ? null : (prev.overtimeStart ?? prev.scheduledEnd),
                          overtimeEnd: e.target.checked ? null : (prev.overtimeEnd ?? '22:00'),
                        }))
                      }
                    />
                    残業不可
                  </label>
                </div>
                <div className={styles.timePair}>
                  <div className={styles.field}>
                    <label>残業開始時刻</label>
                    <input
                      type="time"
                      value={form.overtimeStart ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeStart: e.target.value || null,
                        }))
                      }
                      disabled={!form.overtimeAllowed}
                      placeholder="未設定"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>残業終了時刻</label>
                    <input
                      type="time"
                      value={form.overtimeEnd ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeEnd: e.target.value || null,
                        }))
                      }
                      disabled={!form.overtimeAllowed}
                      placeholder="未設定"
                    />
                  </div>
                </div>
                <div className={styles.fieldWide}>
                  <label>休日設定</label>
                  <div className={styles.holidayModePicker}>
                    <label className={styles.holidayModeItem}>
                      <input
                        type="radio"
                        name="holidayMode"
                        checked={form.holidayMode === 'calendar'}
                        onChange={() => setForm((prev) => ({ ...prev, holidayMode: 'calendar' }))}
                      />
                      <span>会社カレンダーに従う</span>
                    </label>
                    <label className={styles.holidayModeItem}>
                      <input
                        type="radio"
                        name="holidayMode"
                        checked={form.holidayMode === 'individual'}
                        onChange={() => setForm((prev) => ({ ...prev, holidayMode: 'individual' }))}
                      />
                      <span>個別設定（曜日指定）</span>
                    </label>
                  </div>
                  {form.holidayMode === 'individual' && (
                    <div className={styles.holidayDaysPicker}>
                      {['日', '月', '火', '水', '木', '金', '土'].map((label, idx) => (
                        <label key={idx} className={styles.holidayDayItem}>
                          <input
                            type="checkbox"
                            checked={form.holidayDays.includes(idx)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.holidayDays, idx].sort()
                                : form.holidayDays.filter((d) => d !== idx)
                              setForm((prev) => ({ ...prev, holidayDays: next }))
                            }}
                          />
                          <span className={`${styles.holidayDayLabel} ${form.holidayDays.includes(idx) ? styles.holidayDayLabelActive : ''}`}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>給与情報</div>
              <div className={styles.fieldGrid}>
                {form.employeeType === 'パート' ? (
                  <div className={styles.field}>
                    <label>時給（円）</label>
                    <input
                      type="number"
                      value={form.hourlyRate}
                      onChange={(e) => handleChange('hourlyRate', Number(e.target.value))}
                      min={0}
                      placeholder="例: 1200"
                    />
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label>基本給（月給）</label>
                    <input
                      type="number"
                      value={form.basicSalary}
                      onChange={(e) => handleChange('basicSalary', Number(e.target.value))}
                      min={0}
                      placeholder="例: 300000"
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label>標準報酬月額</label>
                  <input
                    type="number"
                    value={form.standardMonthlyRemuneration}
                    onChange={(e) => handleChange('standardMonthlyRemuneration', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>交通費</label>
                  <input
                    type="number"
                    value={form.transportAllowance}
                    onChange={(e) => handleChange('transportAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>役職手当</label>
                  <input
                    type="number"
                    value={form.positionAllowance}
                    onChange={(e) => handleChange('positionAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>家族手当</label>
                  <input
                    type="number"
                    value={form.familyAllowance}
                    onChange={(e) => handleChange('familyAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>特別手当</label>
                  <input
                    type="number"
                    value={form.specialAllowance}
                    onChange={(e) => handleChange('specialAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>危険手当</label>
                  <input
                    type="number"
                    value={form.dangerAllowance}
                    onChange={(e) => handleChange('dangerAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>営業手当</label>
                  <input
                    type="number"
                    value={form.salesAllowance}
                    onChange={(e) => handleChange('salesAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                社会保険料
                {autoInsurance && <span className={styles.autoCalcBadge}>自動計算</span>}
              </div>
              {autoInsurance ? (
                <div className={styles.autoCalcGrid}>
                  <div className={styles.autoCalcItem}>
                    <span className={styles.autoCalcLabel}>健康保険料</span>
                    <span className={styles.autoCalcValue}>{yen(autoInsurance.healthInsurance)}</span>
                    <span className={styles.autoCalcRate}>料率 {(INSURANCE_RATES.healthRate * 100).toFixed(3)}%</span>
                  </div>
                  <div className={styles.autoCalcItem}>
                    <span className={styles.autoCalcLabel}>
                      介護保険料
                      {age !== null && age < 40 && <span className={styles.notApplicable}>（対象外）</span>}
                    </span>
                    <span className={styles.autoCalcValue}>{yen(autoInsurance.nursingInsurance)}</span>
                    <span className={styles.autoCalcRate}>
                      {age !== null && age >= 40
                        ? `料率 ${(INSURANCE_RATES.nursingRate * 100).toFixed(3)}%`
                        : '40歳以上が対象'}
                    </span>
                  </div>
                  <div className={styles.autoCalcItem}>
                    <span className={styles.autoCalcLabel}>厚生年金保険料</span>
                    <span className={styles.autoCalcValue}>{yen(autoInsurance.welfarePension)}</span>
                    <span className={styles.autoCalcRate}>料率 {(INSURANCE_RATES.pensionRate * 100).toFixed(2)}%</span>
                  </div>
                  <div className={styles.autoCalcItem}>
                    <span className={styles.autoCalcLabel}>雇用保険料</span>
                    <span className={styles.autoCalcValue}>{yen(autoInsurance.employmentInsurance)}</span>
                    <span className={styles.autoCalcRate}>料率 {(INSURANCE_RATES.employmentRate * 100).toFixed(1)}%（総支給額ベース）</span>
                  </div>
                </div>
              ) : (
                <div className={styles.autoCalcHint}>
                  生年月日と標準報酬月額を入力すると自動計算されます
                </div>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>その他控除</div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>住民税</label>
                  <input
                    type="number"
                    value={form.residentTax}
                    onChange={(e) => handleChange('residentTax', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>積立金</label>
                  <input
                    type="number"
                    value={form.savingsDeduction}
                    onChange={(e) => handleChange('savingsDeduction', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>貸付</label>
                  <input
                    type="number"
                    value={form.loanDeduction}
                    onChange={(e) => handleChange('loanDeduction', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>扶養人数</label>
                  <input
                    type="number"
                    value={form.dependents}
                    onChange={(e) => handleChange('dependents', Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className={styles.saveButton}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
