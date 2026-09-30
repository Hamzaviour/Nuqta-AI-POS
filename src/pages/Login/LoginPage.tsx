import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, AlertCircle, Crown, Shield, ShoppingBag, ChevronRight,
  Delete, Lock, WifiOff, Keyboard, CalendarCheck, Mic
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { UserPublic } from '../../types'
import { NuqtaLogo, BRAND } from '../../components/brand/NuqtaLogo'
import '../../styles/login.css'

const EASE = [0.16, 1, 0.3, 1] as const

const roleLabel = (role: string) => {
  switch (role) {
    case 'owner': return 'Owner'
    case 'manager': return 'Store Manager'
    default: return 'Sales Executive'
  }
}

const roleIcon = (role: string, size = 12) => {
  switch (role) {
    case 'owner': return <Crown size={size} />
    case 'manager': return <Shield size={size} />
    default: return <ShoppingBag size={size} />
  }
}

const roleTheme = (role: string) => {
  switch (role) {
    case 'owner':
      return { gradient: 'linear-gradient(135deg, #5B78FF 0%, #1E30C4 100%)', text: '#9DB0FF', ring: 'rgba(91, 120, 255, 0.45)' }
    case 'manager':
      return { gradient: 'linear-gradient(135deg, #A78BFA 0%, #6D28D9 100%)', text: '#C4B5FD', ring: 'rgba(167, 139, 250, 0.45)' }
    default:
      return { gradient: 'linear-gradient(135deg, #34D399 0%, #047857 100%)', text: '#6EE7B7', ring: 'rgba(52, 211, 153, 0.45)' }
  }
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

export default function LoginPage() {
  const { login } = useAuth()
  const reduceMotion = useReducedMotion()
  const [users, setUsers]               = useState<UserPublic[] | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null)
  const [pin, setPin]                   = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [step, setStep]                 = useState<'select' | 'pin'>('select')
  const [storeName, setStoreName]       = useState('')
  const [now, setNow]                   = useState(new Date())
  const [shakeKey, setShakeKey]         = useState(0)
  const pinRef                          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getUsersForLogin().then(list => setUsers(list)).catch(() => setUsers([]))
    window.api.getAllSettings?.()
      .then(s => setStoreName((s as unknown as Record<string, string>)['company_name'] || ''))
      .catch(() => {})
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => pinRef.current?.focus(), 120)
    }
  }, [step])

  const selectUser = (user: UserPublic) => {
    setSelectedUser(user)
    setPin('')
    setError('')
    setStep('pin')
  }

  const goBack = () => { setStep('select'); setPin(''); setError('') }

  const handlePinKey = (digit: string) => {
    if (pin.length < 6) {
      setPin(p => p + digit)
      setError('')
    }
    pinRef.current?.focus()
  }

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1))
    pinRef.current?.focus()
  }

  const handleLogin = async () => {
    if (!selectedUser || pin.length < 4 || loading) return
    setLoading(true)
    const result = await login(selectedUser.username, pin)
    if (result.success) {
      window.location.hash = '#/pos'
    } else {
      setError(result.error || 'Incorrect PIN. Please try again.')
      setPin('')
      setShakeKey(k => k + 1)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pin.length === 4 || pin.length === 6) {
      handleLogin()
    }
  }, [pin])

  const handleKeyboardPin = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
    if (e.key === 'Escape') goBack()
  }

  // Keyboard shortcut listener on user select screen (1-9)
  useEffect(() => {
    if (step !== 'select' || !users) return
    const handleKeySelect = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= users.length) {
        selectUser(users[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeySelect)
    return () => window.removeEventListener('keydown', handleKeySelect)
  }, [step, users])

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="login-root">
      {/* ---------- LEFT: BRAND STAGE ---------- */}
      <section className="login-stage">
        <div className="login-stage-pattern" />
        {!reduceMotion && (
          <>
            <motion.div
              className="login-orb login-orb-cobalt"
              animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="login-orb login-orb-saffron"
              animate={{ x: [0, -30, 10, 0], y: [0, 20, -25, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ position: 'relative', zIndex: 2 }}
        >
          <NuqtaLogo size={40} descriptor={BRAND.descriptor} />
        </motion.div>

        <div className="login-stage-hero">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            Every sale,<br />to the point<span style={{ color: 'var(--color-accent)' }}>.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          >
            An AI point of sale for the shop floor. Say the items and get the bill,
            or bill from the keyboard. Stock, purchases and accounts included.
          </motion.p>

          <motion.ul
            className="login-points"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}
          >
            {[
              { icon: Mic, text: 'Voice billing: say the items, get the bill' },
              { icon: Keyboard, text: 'F-key driven billing, no mouse needed' },
              { icon: WifiOff, text: 'Keeps selling when the internet drops' },
              { icon: CalendarCheck, text: 'Day close with staff-wise profit' }
            ].map(({ icon: Icon, text }) => (
              <motion.li
                key={text}
                variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <span className="login-point-icon"><Icon size={14} /></span>
                {text}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <div className="login-stage-foot">
          <div>
            <div className="login-clock">
              {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="login-date">
              {now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="login-status">
            <span className="login-status-dot" />
            Terminal 01 ready
          </div>
        </div>
      </section>

      {/* ---------- RIGHT: SIGN-IN PANEL ---------- */}
      <section className="login-panel">
        <div className="login-panel-inner">
          <AnimatePresence mode="wait">
            {step === 'select' ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="login-eyebrow">{storeName || greeting}</div>
                <h2 className="login-title">Who's at the counter?</h2>
                <p className="login-sub">
                  Pick your profile or press its number key
                  <kbd className="login-kbd">1</kbd>–<kbd className="login-kbd">9</kbd>
                </p>

                <div className="login-staff-list" role="list">
                  {users === null ? (
                    [0, 1, 2].map(i => <div key={i} className="login-staff-skeleton" />)
                  ) : users.length === 0 ? (
                    <div className="login-empty">
                      No active staff profiles found. Ask the owner to enable an account in System Maintenance.
                    </div>
                  ) : (
                    users.map((user, idx) => {
                      const theme = roleTheme(user.role)
                      return (
                        <motion.button
                          key={user.id}
                          role="listitem"
                          className="login-staff"
                          onClick={() => selectUser(user)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: 0.04 * idx, ease: EASE }}
                          whileTap={{ scale: 0.985 }}
                          style={{ ['--ring' as string]: theme.ring } as React.CSSProperties}
                        >
                          <span className="login-avatar" style={{ background: theme.gradient }}>
                            {initials(user.name)}
                          </span>
                          <span className="login-staff-text">
                            <span className="login-staff-name">{user.name}</span>
                            <span className="login-staff-role" style={{ color: theme.text }}>
                              {roleIcon(user.role)} {roleLabel(user.role)}
                            </span>
                          </span>
                          {idx < 9 && <kbd className="login-kbd login-staff-key">{idx + 1}</kbd>}
                          <ChevronRight size={16} className="login-staff-chevron" />
                        </motion.button>
                      )
                    })
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pin"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <button className="login-back" onClick={goBack}>
                  <ArrowLeft size={14} /> Switch profile <kbd className="login-kbd">Esc</kbd>
                </button>

                <div className="login-who">
                  <span
                    className="login-avatar login-avatar-lg"
                    style={{ background: roleTheme(selectedUser!.role).gradient }}
                  >
                    {initials(selectedUser!.name)}
                  </span>
                  <div>
                    <h2 className="login-title" style={{ margin: 0 }}>{selectedUser!.name}</h2>
                    <div className="login-staff-role" style={{ color: roleTheme(selectedUser!.role).text }}>
                      {roleIcon(selectedUser!.role)} {roleLabel(selectedUser!.role)}
                    </div>
                  </div>
                </div>

                <label className="login-pin-label" htmlFor="login-pin">
                  <Lock size={13} /> Enter your PIN
                </label>

                <motion.div
                  key={shakeKey}
                  className="login-pin-dots"
                  animate={shakeKey && !reduceMotion ? { x: [0, -10, 10, -6, 6, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  onClick={() => pinRef.current?.focus()}
                >
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const filled = i < pin.length
                    return (
                      <motion.span
                        key={i}
                        className={`login-pin-dot${filled ? ' filled' : ''}${i >= 4 ? ' optional' : ''}${error ? ' error' : ''}`}
                        animate={{ scale: filled ? [1, 1.3, 1] : 1 }}
                        transition={{ duration: 0.18 }}
                      />
                    )
                  })}
                </motion.div>

                <div className="login-error-slot" aria-live="polite">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="login-error"
                    >
                      <AlertCircle size={14} /> {error}
                    </motion.div>
                  )}
                </div>

                {/* Invisible input capturing the physical keyboard */}
                <input
                  id="login-pin"
                  ref={pinRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setPin(v)
                    setError('')
                  }}
                  onKeyDown={handleKeyboardPin}
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                  autoFocus
                />

                <div className="login-keypad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) =>
                    key === '' ? <span key={i} /> : (
                      <motion.button
                        key={i}
                        type="button"
                        className={`login-key${key === 'del' ? ' login-key-del' : ''}`}
                        whileTap={{ scale: 0.92 }}
                        disabled={loading}
                        tabIndex={-1}
                        aria-label={key === 'del' ? 'Delete digit' : key}
                        onClick={() => key === 'del' ? handleBackspace() : handlePinKey(key)}
                      >
                        {key === 'del' ? <Delete size={20} /> : key}
                      </motion.button>
                    )
                  )}
                </div>

                <button
                  onClick={handleLogin}
                  disabled={pin.length < 4 || loading}
                  className="btn btn-primary btn-full login-submit"
                >
                  {loading ? 'Checking PIN…' : 'Open register'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="login-panel-foot">
          {BRAND.product} · v{BRAND.version}
        </div>
      </section>
    </div>
  )
}
