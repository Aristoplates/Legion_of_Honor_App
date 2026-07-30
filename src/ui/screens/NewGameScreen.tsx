/**
 * Booklet Setup Section C "Optional Rules", plus naming the save. Shown once,
 * before the first Grognard is created.
 */
import { useState } from 'react'
import { createEvent } from '../../domain/events'
import type { OptionalRules } from '../../domain/types'
import { useGameStore } from '../../store/gameStore'

export function NewGameScreen() {
  const dispatch = useGameStore((s) => s.dispatch)
  const [name, setName] = useState('Campaign')
  const [rules, setRules] = useState<OptionalRules>({ fairSex: false, spain: false, other: false })

  function toggle(key: keyof OptionalRules) {
    setRules((r) => ({ ...r, [key]: !r[key] }))
  }

  function start() {
    const trimmed = name.trim() || 'Campaign'
    dispatch(
      createEvent(
        { type: 'GAME_CREATED', id: `game_${Date.now()}`, name: trimmed, optionalRules: rules },
        { label: `Started "${trimmed}"` },
      ),
    )
  }

  return (
    <div className="card">
      <div className="card__head">
        <h2>New Campaign</h2>
      </div>
      <p className="muted">Setup Section C: decide which optional rules are in effect.</p>

      <input
        className="btn"
        style={{ width: '100%', marginBottom: '0.75rem' }}
        placeholder="Campaign name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="row" style={{ marginBottom: '0.4rem' }}>
        <input type="checkbox" checked={rules.fairSex} onChange={() => toggle('fairSex')} />
        <span>Fair Sex</span>
      </label>
      <label className="row" style={{ marginBottom: '0.4rem' }}>
        <input type="checkbox" checked={rules.spain} onChange={() => toggle('spain')} />
        <span>Spain</span>
      </label>
      <label className="row" style={{ marginBottom: '0.75rem' }}>
        <input type="checkbox" checked={rules.other} onChange={() => toggle('other')} />
        <span>Others</span>
      </label>

      <button className="btn btn--primary" onClick={start}>
        Start — Add Grognards
      </button>
    </div>
  )
}
