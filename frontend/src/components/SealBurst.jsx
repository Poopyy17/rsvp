const SPARKLES = Array.from({ length: 10 }, (_, i) => ({
  angle: i * 36,
  distance: 30 + (i % 3) * 8,
  delay: (i % 5) * 18,
}))

export default function SealBurst() {
  return (
    <span className="seal-wrap" aria-hidden="true">
      <span className="confetti-burst">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="confetti-particle"
            style={{
              '--angle': `${s.angle}deg`,
              '--distance': `${s.distance}px`,
              '--delay': `${s.delay}ms`,
            }}
          />
        ))}
      </span>
      <span className="seal">
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M15 24.5l6 6 12-13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  )
}
