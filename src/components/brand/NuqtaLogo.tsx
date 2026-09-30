import React, { useId } from 'react'

export const BRAND = {
  name: 'Nuqta',
  product: 'Nuqta AI POS',
  tagline: 'Every sale, to the point.',
  descriptor: 'AI POS',
  version: '2.0'
}

/** The Nuqta mark: a calligraphic nuqta that doubles as a price tag, with a saffron "point". */
export function NuqtaMark({ size = 40, style }: { size?: number; style?: React.CSSProperties }) {
  const uid = useId().replace(/:/g, '')
  const body = `nq-body-${uid}`
  const point = `nq-point-${uid}`
  const hole = `nq-hole-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" style={style} aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="80" y1="70" x2="360" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C95FF" />
          <stop offset="0.5" stopColor="#3553F7" />
          <stop offset="1" stopColor="#1E2FC2" />
        </linearGradient>
        <linearGradient id={point} x1="340" y1="340" x2="450" y2="450" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC857" />
          <stop offset="1" stopColor="#FF9A1F" />
        </linearGradient>
        <mask id={hole}>
          <rect width="512" height="512" fill="#fff" />
          <circle cx="222" cy="132" r="28" fill="#000" />
          <path d="M392 288 L496 392 L392 496 L288 392 Z" fill="#000" />
        </mask>
      </defs>
      <path
        mask={`url(#${hole})`}
        d="M222 48 L396 222 L222 396 L48 222 Z"
        fill={`url(#${body})`}
        stroke={`url(#${body})`}
        strokeWidth="40"
        strokeLinejoin="round"
      />
      <path
        d="M392 322 L462 392 L392 462 L322 392 Z"
        fill={`url(#${point})`}
        stroke={`url(#${point})`}
        strokeWidth="18"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark + "nuqta.ai" wordmark. The saffron period is the brand's nuqta. */
export function NuqtaLogo({
  size = 36,
  tone = 'light',
  descriptor,
  style
}: {
  size?: number
  tone?: 'light' | 'dark'
  descriptor?: string
  style?: React.CSSProperties
}) {
  const ink = tone === 'light' ? '#FFFFFF' : 'var(--color-text-primary)'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }}>
      <NuqtaMark size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: size * 0.72,
            letterSpacing: '-0.035em',
            color: ink
          }}
        >
          nuqta<span style={{ color: 'var(--color-accent)' }}>.</span>ai
        </span>
        {descriptor && (
          <span
            style={{
              marginTop: size * 0.1,
              fontSize: Math.max(9, size * 0.24),
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tone === 'light' ? 'rgba(255,255,255,0.5)' : 'var(--color-text-muted)'
            }}
          >
            {descriptor}
          </span>
        )}
      </div>
    </div>
  )
}
