import { useId, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useApp } from '@/app/state'
import { authApi } from '@/api/client'
import { ApiError } from '@/shared/api'
import { GoogleG, Mark } from '@/components/brand'
import { Banner, Button, Checkbox, Modal, ModalHeader, Segmented, TextField } from '@/components/ui'

type Tab = 'login' | 'register'

export function AuthModal() {
  const { auth, closeAuth, isGuest } = useApp()
  if (!auth || !isGuest) return null
  // remount when the requested variant changes so presets apply cleanly
  return <AuthInner key={`${auth.variant}-${auth.gate ?? ''}`} onClose={closeAuth} />
}

function AuthInner({ onClose }: { onClose: () => void }) {
  const { auth, setGuest, go, route, toast, isGuest } = useApp()
  const v = auth!.variant ?? 'login'
  const titleId = useId()
  const consentHelpId = useId()

  const [tab, setTab] = useState<Tab>(v === 'register' || v === 'fieldErrors' || v === 'guestGate' ? 'register' : 'login')
  const [email, setEmail] = useState(v === 'login' || v === 'register' || v === 'guestGate' ? '' : 'minhanh@gmail.com')
  const [password, setPassword] = useState(v === 'fieldErrors' ? '1234' : v === 'login' || v === 'register' || v === 'guestGate' ? '' : '••••••••••')
  const [confirm, setConfirm] = useState(v === 'fieldErrors' ? '12345' : '')
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [google, setGoogle] = useState(false)
  const consentRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>(
    v === 'fieldErrors' ? { email: 'Email này đã được đăng ký', password: 'Mật khẩu cần ít nhất 12 ký tự', confirm: 'Mật khẩu xác nhận không khớp' } : {},
  )
  const [formError, setFormError] = useState<null | 'failed' | 'rate' | string>(v === 'loginFailed' ? 'failed' : v === 'rateLimited' ? 'rate' : null)
  const [loading, setLoading] = useState(v === 'loading')
  const [attempts, setAttempts] = useState(0)

  const gate = auth!.gate
  const fromGate = v === 'guestGate' || !!gate

  const switchTab = (t: Tab) => {
    setTab(t)
    setErrors({})
    setConsentError(false)
    setFormError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formError === 'rate') return
    const errs: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Nhập email hợp lệ, ví dụ ten@email.com'
    if (tab === 'register' && email.trim().toLowerCase() === 'minhanh@gmail.com') errs.email = 'Email này đã được đăng ký'
    if (tab === 'register' && password.length < 12) errs.password = 'Mật khẩu cần ít nhất 12 ký tự'
    if (tab === 'login' && !password) errs.password = 'Nhập mật khẩu'
    if (tab === 'register' && !confirm) errs.confirm = 'Nhập lại mật khẩu'
    else if (tab === 'register' && confirm !== password) errs.confirm = 'Mật khẩu xác nhận không khớp'
    setErrors(errs)
    setFormError(null)
    if (Object.keys(errs).length) return

    if (tab === 'register' && !consent) {
      setConsentError(true)
      consentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      consentRef.current?.querySelector('input')?.focus({ preventScroll: true })
      return
    }

    setLoading(true)
    try {
      if (tab === 'login') {
        // demo/mock check: any password containing "sai" fails
        if (password.includes('sai')) {
          const n = attempts + 1
          setAttempts(n)
          setFormError(n >= 3 ? 'rate' : 'failed')
          return
        }
        await authApi.login({ email, password })
        success('Đã đăng nhập')
      } else {
        await authApi.register({
          email,
          password,
          full_name: email.split('@')[0],
          consent: {
            is_accepted: true,
            version: 'health-ai-v1',
            scope: 'HEALTH_DATA_AND_AI_PROCESSING',
          },
        })
        success('Đã tạo tài khoản')
      }
    } catch (err) {
      if (tab === 'login') {
        const n = attempts + 1
        setAttempts(n)
        setFormError(n >= 3 ? 'rate' : 'failed')
      } else {
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setErrors({ email: 'Email này đã được đăng ký' })
          } else if (err.status === 422 && err.details?.length) {
            const fieldErrs: typeof errors = {}
            let unmapped = false
            for (const d of err.details) {
              const field = d.loc?.[d.loc.length - 1]
              if (field === 'password') {
                fieldErrs.password = 'Mật khẩu cần ít nhất 12 ký tự'
              } else if (field === 'email') {
                fieldErrs.email = 'Email không hợp lệ'
              } else {
                unmapped = true
              }
            }
            if (Object.keys(fieldErrs).length) {
              setErrors(fieldErrs)
            }
            if (unmapped || !Object.keys(fieldErrs).length) {
              setFormError(err.message || 'Dữ liệu không hợp lệ')
            }
          } else {
            setFormError(err.message || 'Không thể đăng ký tài khoản này')
          }
        } else {
          const msg = err instanceof Error ? err.message : 'Không thể đăng ký tài khoản này'
          setFormError(msg)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const success = (msg: string) => {
    setGuest(false)
    onClose()
    toast(msg)
    if (route === 'onboarding') go('dashboard')
  }

  // Google sign-up still needs the health-data consent; point the user to it instead of failing silently.
  const withGoogle = () => {
    if (tab === 'register' && !consent) {
      setConsentError(true)
      consentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      consentRef.current?.querySelector('input')?.focus({ preventScroll: true })
      return
    }
    setGoogle(true)
    setTimeout(() => {
      setGoogle(false)
      if (tab === 'register') {
        success('Đã đăng ký bằng Google')
      } else {
        success('Đã đăng nhập bằng Google')
      }
    }, 1100)
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <ModalHeader
        id={titleId}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2.5">
            <Mark size={24} />
            {tab === 'login' ? 'Đăng nhập VitaP' : 'Tạo tài khoản VitaP'}
          </span>
        }
        sub={tab === 'login' ? 'Chào mừng bạn quay lại.' : 'Lưu đơn thuốc, ghi chép sức khỏe và trò chuyện với trợ lý.'}
      />
      <form onSubmit={submit} noValidate className="flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
        {fromGate && gate && (
          <Banner tone="info" className="mb-4">
            {gate}
          </Banner>
        )}
        {v === 'sessionExpired' && (
          <Banner tone="neutral" icon={<Clock size={20} />} className="mb-4">
            Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
          </Banner>
        )}

        <Segmented
          label="Chọn đăng nhập hoặc đăng ký"
          className="mb-5 flex w-full"
          value={tab}
          onChange={switchTab}
          options={[
            { value: 'login', label: 'Đăng nhập' },
            { value: 'register', label: 'Đăng ký' },
          ]}
        />

        {formError === 'failed' && (
          <Banner tone="error" className="mb-4">
            Email hoặc mật khẩu không đúng
          </Banner>
        )}
        {formError === 'rate' && (
          <Banner tone="error" icon={<Clock size={20} />} className="mb-4">
            Bạn đã thử quá nhiều lần. Vui lòng thử lại sau vài phút.
          </Banner>
        )}
        {typeof formError === 'string' && formError !== 'failed' && formError !== 'rate' && (
          <Banner tone="error" className="mb-4">
            {formError}
          </Banner>
        )}

        <button
          type="button"
          onClick={withGoogle}
          disabled={google || formError === 'rate'}
          aria-busy={google || undefined}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-200 bg-surface text-[15px] font-medium text-ink-900 transition-colors hover:border-ink-400 hover:bg-bg-50 disabled:opacity-60"
        >
          {google ? <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-line-200 border-t-brand-600" aria-hidden /> : <GoogleG />}
          {google ? 'Đang kết nối Google…' : tab === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}
        </button>
        <div className="my-5 flex items-center gap-3 text-[12px] text-ink-600" aria-hidden>
          <span className="h-px flex-1 bg-line-200" />
          hoặc dùng email
          <span className="h-px flex-1 bg-line-200" />
        </div>

        <div className="space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="ten@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            data-autofocus
          />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            helper={tab === 'register' ? 'Ít nhất 12 ký tự' : undefined}
          />
          {tab === 'register' && (
            <TextField
              label="Xác nhận mật khẩu"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              helper={confirm && confirm === password ? 'Mật khẩu đã khớp' : undefined}
            />
          )}
        </div>

        {tab === 'login' && (
          <div className="mt-2 flex justify-end">
            <button type="button" className="rounded text-sm font-medium text-brand-fg hover:underline">
              Quên mật khẩu?
            </button>
          </div>
        )}

        {tab === 'register' && (
          <div ref={consentRef} className={`mt-5 rounded-xl border p-4 transition-colors ${consentError && !consent ? 'border-red-ink bg-red-bg/40' : 'border-line-200 bg-bg-50'}`}>
            <Checkbox
              checked={consent}
              onChange={(c) => {
                setConsent(c)
                if (c) setConsentError(false)
              }} required describedBy={consent ? undefined : consentHelpId}>
              Tôi đồng ý cho VitaP xử lý dữ liệu sức khỏe của tôi để cung cấp các tính năng của ứng dụng.{' '}
              <a href="#" onClick={(e) => e.preventDefault()} className="font-medium text-brand-fg underline underline-offset-2">
                Tìm hiểu thêm
              </a>
            </Checkbox>
          </div>
        )}

        <Button
          type="submit"
          block
          className="mt-6"
          loading={loading}
          disabled={(tab === 'register' && !consent) || formError === 'rate'}
          aria-describedby={tab === 'register' && !consent ? consentHelpId : undefined}
        >
          {loading ? (tab === 'login' ? 'Đang đăng nhập…' : 'Đang tạo tài khoản…') : tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </Button>
        {tab === 'register' && !consent && (
          <p id={consentHelpId} className={`mt-2 text-center text-sm ${consentError ? 'font-medium text-red-ink' : 'text-ink-600'}`}>
            Cần đồng ý để tạo tài khoản
          </p>
        )}

        {!fromGate && (
          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setGuest(true)
                onClose()
                if (route === 'onboarding' || !isGuest) go('scan', 'upload')
              }}
            >
              Tiếp tục với tư cách khách
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
