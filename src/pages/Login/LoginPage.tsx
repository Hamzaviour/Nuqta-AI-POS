import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, ArrowLeft, Lock, User, KeyRound,
  Sparkles, CheckCircle2, ChevronRight, Store, AlertCircle,
  Crown, Shield, ShoppingBag, Terminal, Check
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { UserPublic } from '../../types'
import logoImg from '../../assets/logo.png'

export default function LoginPage() {
  const { login } = useAuth()
  const [users, setUsers]               = useState<UserPublic[]>([])
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null)
  const [pin, setPin]                   = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [step, setStep]                 = useState<'select' | 'pin'>('select')
  const pinRef                          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getUsersForLogin().then(list => {
      setUsers(list)
    })
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

  const handlePinKey = (digit: string) => {
    if (pin.length < 6) {
      setPin(p => p + digit)
      setError('')
    }
  }

  const handleBackspace = () => setPin(p => p.slice(0, -1))

  const handleLogin = async () => {
    if (!selectedUser || pin.length < 4) return
    setLoading(true)
    const result = await login(selectedUser.username, pin)
    if (result.success) {
      window.location.hash = '#/pos'
    } else {
      setError(result.error || 'Invalid PIN. Please check and try again.')
      setPin('')
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
    if (e.key === 'Escape') { setStep('select'); setPin(''); setError('') }
  }

  // Keyboard shortcut listener on user select screen (1-9)
  useEffect(() => {
    if (step !== 'select') return
    const handleKeySelect = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= users.length) {
        selectUser(users[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeySelect)
    return () => window.removeEventListener('keydown', handleKeySelect)
  }, [step, users])

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner / Administrator'
      case 'manager': return 'Store Manager'
      default: return 'Sales Executive'
    }
  }

  const roleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown size={14} />
      case 'manager': return <Shield size={14} />
      default: return <ShoppingBag size={14} />
    }
  }

  const roleTheme = (role: string) => {
    switch (role) {
      case 'owner':
        return {
          gradient: 'linear-gradient(135deg, #C41E3A 0%, #7A0C1E 100%)',
          border: 'rgba(196, 30, 58, 0.45)',
          glow: 'rgba(196, 30, 58, 0.35)',
          badgeBg: 'rgba(196, 30, 58, 0.16)',
          badgeText: '#FF758F',
          accent: '#C41E3A'
        }
      case 'manager':
        return {
          gradient: 'linear-gradient(135deg, #0284C7 0%, #034E7B 100%)',
          border: 'rgba(2, 132, 199, 0.45)',
          glow: 'rgba(2, 132, 199, 0.35)',
          badgeBg: 'rgba(2, 132, 199, 0.16)',
          badgeText: '#38BDF8',
          accent: '#0284C7'
        }
      default:
        return {
          gradient: 'linear-gradient(135deg, #10B981 0%, #065F46 100%)',
          border: 'rgba(16, 185, 129, 0.45)',
          glow: 'rgba(16, 185, 129, 0.35)',
          badgeBg: 'rgba(16, 185, 129, 0.16)',
          badgeText: '#34D399',
          accent: '#10B981'
        }
    }
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at 50% 0%, #111827 0%, #080C17 50%, #03050A 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '16px 20px',
      boxSizing: 'border-box',
      userSelect: 'none'
    }}>
      {/* Subtle Ambient Red/Gold Backlight */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 380,
        background: 'radial-gradient(circle, rgba(196, 30, 58, 0.20) 0%, rgba(212, 175, 55, 0.06) 45%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      {/* Grid Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        opacity: 0.75,
        pointerEvents: 'none',
        zIndex: 1
      }} />

      {/* Main Form Box */}
      <div style={{
        width: '100%',
        maxWidth: step === 'select' ? 780 : 420,
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transition: 'max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* CRISP COMPACT BRAND HEADER (Zero Outflow) */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            textAlign: 'center',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {/* Transparent Arabic Calligraphy Logo */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4
          }}>
            {/* Subtle glow aura */}
            <div style={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(196, 30, 58, 0.4) 0%, transparent 70%)',
              filter: 'blur(16px)',
              zIndex: 0
            }} />

            <img
              src={logoImg}
              alt="Al-Deewan Brand"
              style={{
                height: 84,
                width: 'auto',
                maxWidth: 160,
                objectFit: 'contain',
                position: 'relative',
                zIndex: 2,
                imageRendering: '-webkit-optimize-contrast',
                filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.65)) drop-shadow(0 0 12px rgba(196,30,58,0.5))'
              }}
            />
          </div>

          {/* Typography */}
          <h1 style={{
            color: '#FFFFFF',
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
            lineHeight: 1.1,
            background: 'linear-gradient(180deg, #FFFFFF 25%, #E2E8F0 80%, #CBD5E1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))'
          }}>
            AL-DEEWAN
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 4
          }}>
            <span style={{ height: 1, width: 24, background: 'linear-gradient(90deg, transparent, #D4AF37)' }} />
            <span style={{
              color: '#F1C40F',
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-sans)',
              textShadow: '0 0 8px rgba(241, 196, 15, 0.35)'
            }}>
              Wholesale & Retail Clothing POS
            </span>
            <span style={{ height: 1, width: 24, background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />
          </div>
        </motion.div>

        {/* MAIN INTERACTIVE CARD */}
        <AnimatePresence mode="wait">
          {step === 'select' ? (
            /* STEP 1: STAFF SELECTION */
            <motion.div
              key="select"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.88) 0%, rgba(10, 15, 29, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-xl)',
                padding: '22px 24px',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                boxSizing: 'border-box'
              }}
            >
              {/* Header Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div>
                  <h3 style={{ color: '#fff', fontSize: '1.05rem', margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>
                    Select Staff Profile
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: 2 }}>
                    Click profile or press number <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)' }}>1</kbd>-<kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)' }}>9</kbd>
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.7rem',
                  color: '#34D399',
                  fontWeight: 700
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                  Terminal Online
                </div>
              </div>

              {/* Staff Grid */}
              {users.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                  Loading staff profiles...
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 14
                }}>
                  {users.map((user, idx) => {
                    const theme = roleTheme(user.role)
                    return (
                      <motion.button
                        key={user.id}
                        whileHover={{ scale: 1.025, translateY: -3 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => selectUser(user)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.035)',
                          border: '1.5px solid rgba(255, 255, 255, 0.09)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                          position: 'relative',
                          overflow: 'hidden',
                          textAlign: 'center',
                          color: '#fff',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = theme.border
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                          e.currentTarget.style.boxShadow = `0 8px 22px ${theme.glow}`
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)'
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        {/* Number hotkey tag */}
                        <span style={{
                          position: 'absolute',
                          top: 8,
                          right: 10,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          borderRadius: 4,
                          padding: '1px 5px',
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(255,255,255,0.65)',
                          fontWeight: 800
                        }}>
                          #{idx + 1}
                        </span>

                        {/* Avatar */}
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: theme.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.35rem',
                          fontWeight: 900,
                          color: '#fff',
                          boxShadow: `0 6px 18px ${theme.glow}`,
                          border: '2px solid rgba(255,255,255,0.2)'
                        }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div style={{
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: '#fff',
                            letterSpacing: '-0.01em'
                          }}>
                            {user.name}
                          </div>

                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: theme.badgeBg,
                            color: theme.badgeText,
                            border: `1px solid ${theme.border}`,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                            marginTop: 5
                          }}>
                            {roleIcon(user.role)}
                            <span>{user.role}</span>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: '0.7rem',
                          color: 'rgba(255,255,255,0.4)',
                          fontWeight: 600
                        }}>
                          <span>Sign In</span>
                          <ChevronRight size={13} />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            /* STEP 2: PIN ENTRY & KEYPAD */
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.90) 0%, rgba(10, 15, 29, 0.96) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px 22px',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 24px 72px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                boxSizing: 'border-box'
              }}
            >
              {/* Selected Staff Header Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: roleTheme(selectedUser!.role).gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  color: '#fff',
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${roleTheme(selectedUser!.role).glow}`
                }}>
                  {selectedUser!.name.charAt(0)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
                    {selectedUser!.name}
                  </div>
                  <div style={{
                    color: roleTheme(selectedUser!.role).badgeText,
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {roleIcon(selectedUser!.role)}
                    <span>{roleLabel(selectedUser!.role)}</span>
                  </div>
                </div>

                <button
                  onClick={() => { setStep('select'); setPin(''); setError('') }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px 10px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    cursor: 'pointer',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                >
                  <ArrowLeft size={12} />
                  Change
                </button>
              </div>

              {/* PIN Dots Area */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem', marginBottom: 10, fontWeight: 600 }}>
                  Enter your Security PIN
                </p>

                {/* Animated PIN Dots */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '4px 0'
                }}>
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const filled = i < pin.length
                    return (
                      <motion.div
                        key={i}
                        animate={{
                          scale: filled ? [1, 1.25, 1.1] : 1,
                          backgroundColor: filled ? '#C41E3A' : 'rgba(255, 255, 255, 0.12)'
                        }}
                        transition={{ duration: 0.15 }}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: `1.5px solid ${filled ? '#EF4444' : 'rgba(255, 255, 255, 0.2)'}`,
                          boxShadow: filled ? '0 0 12px rgba(196, 30, 58, 0.85)' : 'none'
                        }}
                      />
                    )
                  })}
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginTop: 10,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      color: '#F87171',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <AlertCircle size={14} />
                    {error}
                  </motion.div>
                )}
              </div>

              {/* Invisible input capturing physical keyboard */}
              <input
                ref={pinRef}
                type="password"
                value={pin}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setPin(v)
                  setError('')
                }}
                onKeyDown={handleKeyboardPin}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                tabIndex={0}
                autoFocus
              />

              {/* Tactile Keypad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginBottom: 14
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((digit, i) => (
                  <motion.button
                    key={i}
                    whileHover={digit ? { scale: 1.04, backgroundColor: 'rgba(255, 255, 255, 0.14)' } : {}}
                    whileTap={digit ? { scale: 0.93 } : {}}
                    onClick={() => {
                      if (digit === '⌫') handleBackspace()
                      else if (digit !== '') handlePinKey(digit)
                    }}
                    disabled={digit === '' || loading}
                    style={{
                      height: 46,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: digit === '⌫'
                        ? 'rgba(239, 68, 68, 0.14)'
                        : digit === ''
                          ? 'transparent'
                          : 'rgba(255, 255, 255, 0.06)',
                      color: digit === '⌫' ? '#F87171' : '#fff',
                      fontSize: digit === '⌫' ? '1rem' : '1.25rem',
                      fontWeight: 800,
                      cursor: digit === '' ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      boxShadow: digit !== '' ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                      transition: 'border-color 0.15s, color 0.15s'
                    }}
                  >
                    {digit}
                  </motion.button>
                ))}
              </div>

              {/* Login Action Button */}
              <button
                onClick={handleLogin}
                disabled={pin.length < 4 || loading}
                className="btn btn-primary btn-full"
                style={{
                  height: 44,
                  fontSize: '0.9375rem',
                  letterSpacing: '0.02em',
                  fontWeight: 800
                }}
              >
                {loading ? 'Authenticating...' : 'Unlock Terminal'}
              </button>

              <div style={{
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.7rem',
                marginTop: 10
              }}>
                Type on keyboard or tap digits above · <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: 3 }}>Esc</kbd> to go back
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <div style={{
          marginTop: 14,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.3)',
          fontSize: '0.7rem',
          letterSpacing: '0.04em'
        }}>
          Al-Deewan Point of Sale · v1.0 Enterprise
        </div>
      </div>
    </div>
  )
}
