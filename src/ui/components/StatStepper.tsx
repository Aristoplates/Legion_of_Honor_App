/**
 * A labelled number with +/- buttons for the common deltas, plus a tap on the
 * value itself for exact entry — the escape hatch that lets any card result,
 * however unusual, be entered directly instead of fighting the buttons.
 */
interface StatStepperProps {
  label: string
  value: number
  onDelta: (delta: number) => void
  onSet?: (value: number) => void
  steps?: readonly number[]
}

export function StatStepper({ label, value, onDelta, onSet, steps = [-5, -1, 1, 5] }: StatStepperProps) {
  const negative = steps.filter((s) => s < 0)
  const positive = steps.filter((s) => s > 0)

  return (
    <div className="row" style={{ marginBottom: '0.35rem' }}>
      <span className="muted" style={{ width: '2.4rem', flexShrink: 0 }}>
        {label}
      </span>
      {negative.map((s) => (
        <button
          key={s}
          className="btn"
          style={{ minHeight: 32, padding: '0 0.5rem' }}
          onClick={() => onDelta(s)}
        >
          {s}
        </button>
      ))}
      <button
        className="num"
        style={{
          width: '3.2rem',
          textAlign: 'center',
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          fontSize: '1rem',
          cursor: onSet ? 'pointer' : 'default',
        }}
        disabled={!onSet}
        onClick={() => {
          if (!onSet) return
          const input = window.prompt(`Set ${label} to:`, String(value))
          if (input === null) return
          const n = Number(input)
          if (Number.isFinite(n)) onSet(Math.round(n))
        }}
      >
        {value}
      </button>
      {positive.map((s) => (
        <button
          key={s}
          className="btn"
          style={{ minHeight: 32, padding: '0 0.5rem' }}
          onClick={() => onDelta(s)}
        >
          +{s}
        </button>
      ))}
    </div>
  )
}
