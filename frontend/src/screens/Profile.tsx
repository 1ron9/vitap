import { useId, useState } from 'react'
import { HeartPulse, LogOut, Pill, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useApp } from '@/app/state'
import { authApi, clearSessionUserEmail } from '@/api/client'
import { GuestLock } from '@/components/GuestLock'
import { SCREEN_LABEL } from '@/app/variants'
import { BackButton, Button, Card, IconButton, Mono, PageHeader, Segmented, TextField } from '@/components/ui'
import { fmtDate, type GluUnit, SAMPLE_RX, useData } from '@/data/db'
import { cn } from '@/lib/cn'

type AllergyType = 'drug' | 'food' | 'other'
type Allergy = { id: string; name: string; type: AllergyType; reaction: string }
const TYPE_LABEL: Record<AllergyType, string> = { drug: 'Thuốc', food: 'Thực phẩm', other: 'Khác' }

const CONDITION_SUGGEST = ['Tăng huyết áp', 'Đái tháo đường type 2', 'Rối loạn mỡ máu', 'Hen phế quản', 'Suy thận', 'Bệnh gan', 'Gút', 'Viêm dạ dày']

export function Profile() {
  const { isGuest } = useApp()
  if (isGuest)
    return (
      <GuestLock title="Đăng ký để khai báo bệnh nền và dị ứng" body="VitaP dùng hồ sơ này để cảnh báo khi đơn thuốc có thể xung đột với dị ứng của bạn." gate="Đăng ký để khai báo bệnh nền và dị ứng">
        <ProfileInner />
      </GuestLock>
    )
  return <ProfileInner />
}

function ProfileInner() {
  const { setGuest, go, toast, origin } = useApp()
  const { profile, setProfile, prescriptions, currentUserEmail } = useData()
  const empty = prescriptions.length === 0
  const backTo = origin && origin !== 'profile' && origin !== 'onboarding' ? origin : 'dashboard'
  const [conditions, setConditions] = useState<string[]>(() => profile.conditions ?? [])
  const [allergies, setAllergies] = useState<Allergy[]>(() =>
    (profile.allergies ?? []).map((a, i) => ({ id: `a-${i}`, name: a, type: 'drug', reaction: '' })),
  )
  const [noAllergy, setNoAllergy] = useState(false)
  const [cInput, setCInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [perm, setPerm] = useState(() => {
    if (typeof window !== 'undefined' && currentUserEmail) {
      const saved = localStorage.getItem(`vitap-perm-${currentUserEmail}`)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // ignore
        }
      }
    }
    return { ai: true, alert: true }
  })
  const { gluUnit, setGluUnit } = useData()

  const syncPerm = (next: { ai: boolean; alert: boolean }) => {
    setPerm(next)
    if (typeof window !== 'undefined' && currentUserEmail) {
      localStorage.setItem(`vitap-perm-${currentUserEmail}`, JSON.stringify(next))
    }
  }

  const addCondition = (c: string) => {
    const t = c.trim()
    if (!t || conditions.includes(t)) return
    const next = [...conditions, t]
    setConditions(next)
    setProfile({ ...profile, conditions: next })
    setCInput('')
  }

  const removeCondition = (c: string) => {
    const next = conditions.filter((x) => x !== c)
    setConditions(next)
    setProfile({ ...profile, conditions: next })
  }

  const removeAllergy = (id: string) => {
    const next = allergies.filter((x) => x.id !== id)
    setAllergies(next)
    setProfile({ ...profile, allergies: next.map((a) => a.name) })
  }

  return (
    <>
      <BackButton onClick={() => go(backTo)} className="mb-2">
        Quay lại {SCREEN_LABEL[backTo]}
      </BackButton>
      <PageHeader title="Hồ sơ sức khỏe" sub="Thông tin này giúp VitaP cảnh báo dị ứng và trả lời sát với bạn hơn" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Conditions */}
          <Card as="section" className="p-5 sm:p-6">
            <SectionTitle icon={<HeartPulse size={18} />} title="Bệnh nền" sub="Các bệnh đang điều trị hoặc đã được bác sĩ chẩn đoán" />
            {conditions.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {conditions.map((c) => (
                  <li key={c} className="inline-flex h-9 items-center gap-1 rounded-full border border-line-200 bg-bg-50 pr-1 pl-3.5 text-sm font-medium text-ink-900">
                    {c}
                    <button onClick={() => removeCondition(c)} aria-label={`Xóa ${c}`} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-600 hover:bg-line-200">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-line-200 px-4 py-3 text-sm text-ink-600">Chưa khai báo bệnh nền nào.</p>
            )}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addCondition(cInput)
              }}
            >
              <TextField label="Thêm bệnh nền" className="flex-1 [&>label]:sr-only" placeholder="Nhập tên bệnh, ví dụ: Hen phế quản" value={cInput} onChange={(e) => setCInput(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={!cInput.trim()} icon={<Plus size={18} aria-hidden />}>
                Thêm
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Gợi ý">
              {CONDITION_SUGGEST.filter((s) => !conditions.includes(s))
                .slice(0, 5)
                .map((s) => (
                  <button key={s} onClick={() => addCondition(s)} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-line-200 px-3 text-[13px] text-ink-600 hover:border-brand-600 hover:text-brand-ink">
                    <Plus size={13} aria-hidden />
                    {s}
                  </button>
                ))}
            </div>
          </Card>

          {/* Allergies */}
          <Card as="section" className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle icon={<ShieldAlert size={18} />} title="Dị ứng" sub="Dùng để cảnh báo ở bước Kết quả khi quét đơn" />
              {!adding && !noAllergy && (
                <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={() => setAdding(true)}>
                  Thêm dị ứng
                </Button>
              )}
            </div>

            {allergies.length > 0 && (
              <ul className="mt-4 divide-y divide-line-200 rounded-xl border border-line-200">
                {allergies.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-line-100 px-2 text-[12px] font-medium text-ink-600">{TYPE_LABEL[a.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{a.name}</p>
                      <p className="text-sm text-ink-600">Phản ứng: {a.reaction || 'Không rõ'}</p>
                    </div>
                    <IconButton label={`Xóa dị ứng ${a.name}`} onClick={() => removeAllergy(a.id)} className="-my-1.5 -mr-2 h-10 w-10">
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}

            {adding && (
              <AllergyForm
                onCancel={() => setAdding(false)}
                onSave={(a) => {
                  const next = [...allergies, a]
                  setAllergies(next)
                  setProfile({ ...profile, allergies: next.map((x) => x.name) })
                  setAdding(false)
                  setNoAllergy(false)
                  toast('Đã thêm dị ứng')
                }}
              />
            )}

            {allergies.length === 0 && !adding && (
              <div className="mt-4 rounded-xl border border-dashed border-line-200 p-4">
                <p className="text-sm text-ink-900">{noAllergy ? 'Bạn đã xác nhận không có dị ứng nào đã biết.' : 'Chưa khai báo dị ứng.'}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">
                  {noAllergy ? 'Bạn có thể thêm lại bất cứ lúc nào.' : 'Nếu để trống, VitaP sẽ không thể cảnh báo xung đột với dị ứng.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {noAllergy ? (
                    <Button size="sm" variant="ghost" onClick={() => setNoAllergy(false)}>
                      Bỏ xác nhận
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" icon={<Plus size={16} aria-hidden />} onClick={() => setAdding(true)}>
                        Thêm dị ứng
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNoAllergy(true)
                          setAllergies([])
                          setProfile({ ...profile, allergies: [] })
                        }}
                      >
                        Tôi không có dị ứng nào đã biết
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Current meds */}
          <Card as="section" className="p-5 sm:p-6">
            <SectionTitle icon={<Pill size={18} />} title="Thuốc đang dùng" sub="Tự động lấy từ đơn thuốc đã lưu gần nhất" />
            {empty ? (
              <div className="mt-4 rounded-lg border border-dashed border-line-200 px-4 py-3 text-sm text-ink-600">
                Chưa có đơn thuốc nào được lưu.{' '}
                <button onClick={() => go('scan', 'upload')} className="font-medium text-brand-fg hover:underline">
                  Quét đơn
                </button>
              </div>
            ) : (
              (() => {
                const latestRx = prescriptions[0]
                return (
                  <>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {latestRx.drugs.map(({ name: n, strength: s, freq: f }) => (
                        <li key={n} className="rounded-lg bg-bg-50 px-3 py-2.5">
                          <p className="text-sm font-semibold text-ink-900">
                            {n} <Mono className="font-normal text-ink-600">{s}</Mono>
                          </p>
                          <Mono className="text-[12px] text-ink-600">{f}</Mono>
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" size="sm" className="mt-3 -ml-3" onClick={() => go('scan', latestRx.id, 'profile')}>
                      Xem đơn ngày {fmtDate(latestRx.date)}
                    </Button>
                  </>
                )
              })()
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white">
                {profile.fullName ? profile.fullName.trim().split(/\s+/).map((n) => n[0]).slice(-2).join('').toUpperCase() : 'ND'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{profile.fullName || 'Người dùng'}</p>
                <p className="truncate text-sm text-ink-600">{profile.phone || 'Chưa cập nhật SĐT'}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
              {[
                ['Năm sinh', profile.dob ? profile.dob.slice(0, 4) : '—'],
                ['Giới tính', profile.gender || '—'],
              ].map(([k, val]) => (
                <div key={k} className="rounded-lg bg-bg-50 px-2 py-2.5">
                  <dt className="text-xs text-ink-600">{k}</dt>
                  <dd className={cn('mt-0.5 text-sm font-semibold text-ink-900', /\d/.test(val) && 'font-mono')}>{val}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-900">
              Đơn vị đường huyết
            </p>
            <Segmented<GluUnit>
              label="Đơn vị đường huyết"
              value={gluUnit}
              onChange={setGluUnit}
              className="mt-3 flex w-full [&>button]:h-11 [&>button]:flex-1"
              options={[
                { value: 'mmol/L', label: <span className="font-mono">mmol/L</span> },
                { value: 'mg/dL', label: <span className="font-mono">mg/dL</span> },
              ]}
            />
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-900">Quyền sử dụng hồ sơ</p>
            <div className="mt-3 space-y-1">
              <Toggle label="Cho Trợ lý AI dùng hồ sơ này" desc="Hiển thị dưới dạng chip “Dị ứng” trong khung chat" on={perm.ai} onChange={(ai) => syncPerm({ ...perm, ai })} />
              <Toggle label="Cảnh báo xung đột dị ứng" desc="Thêm thẻ cảnh báo ở bước Kết quả khi quét đơn" on={perm.alert} onChange={(alert) => syncPerm({ ...perm, alert })} />
            </div>
          </Card>

          <Button
            variant="secondary"
            block
            icon={<LogOut size={18} aria-hidden />}
            onClick={async () => {
              clearSessionUserEmail()
              try {
                await authApi.logout()
              } catch (err) {
                console.warn('Logout remote call ignored:', err)
              }
              setGuest(true)
              go('onboarding')
              toast('Đã đăng xuất')
            }}
          >
            Đăng xuất
          </Button>
        </aside>
      </div>
    </>
  )
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-fg" aria-hidden>
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="text-sm text-ink-600">{sub}</p>
      </div>
    </div>
  )
}

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        <p className="text-[12px] text-ink-600">{desc}</p>
      </div>
      <button id={id} role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn('relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-150', on ? 'bg-brand-600' : 'bg-line-200')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-e1 transition-all duration-150', on ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

function AllergyForm({ onCancel, onSave }: { onCancel: () => void; onSave: (a: Allergy) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AllergyType>('drug')
  const [reaction, setReaction] = useState('')
  const [err, setErr] = useState<string>()
  return (
    <form
      className="mt-4 space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return setErr('Nhập tên chất gây dị ứng')
        onSave({ id: `a${Date.now()}`, name: name.trim(), type, reaction: reaction.trim() })
      }}
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-900">Loại</p>
        <Segmented
          label="Loại dị ứng"
          value={type}
          onChange={setType}
          options={(Object.keys(TYPE_LABEL) as AllergyType[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))}
          className="flex w-full sm:w-auto"
        />
      </div>
      <TextField label={type === 'drug' ? 'Tên thuốc hoặc hoạt chất' : 'Tên chất gây dị ứng'} placeholder={type === 'drug' ? 'Ví dụ: Penicillin' : 'Ví dụ: Đậu phộng'} value={name} onChange={(e) => setName(e.target.value)} error={err} data-autofocus />
      <TextField label="Phản ứng đã gặp (không bắt buộc)" placeholder="Ví dụ: nổi mề đay, khó thở" value={reaction} onChange={(e) => setReaction(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit">Lưu</Button>
      </div>
    </form>
  )
}
