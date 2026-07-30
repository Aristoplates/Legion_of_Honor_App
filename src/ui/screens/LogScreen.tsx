/**
 * The journal: every event in the order it happened, newest first, with an
 * Undo that drops the last one. Filterable per Grognard so "what happened to
 * my character" is a quick scroll instead of a search.
 */
import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'

export function LogScreen() {
  const events = useGameStore((s) => s.events)
  const grognards = useGameStore((s) => s.state.grognards)
  const undo = useGameStore((s) => s.undo)
  const [filterId, setFilterId] = useState('')

  const roster = Object.values(grognards)
  const visible = [...events]
    .filter((e) => filterId === '' || e.subjects.includes(filterId))
    .reverse()

  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2>Log</h2>
          <span className="badge">{events.length} events</span>
        </div>
        <div className="row row--wrap" style={{ marginBottom: '0.5rem' }}>
          <select
            className="btn"
            style={{ flex: 1 }}
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
          >
            <option value="">All Grognards</option>
            {roster.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn--danger" disabled={events.length === 0} onClick={undo}>
          Undo last event
        </button>
      </div>

      {visible.length === 0 && (
        <div className="card">
          <p className="muted">Nothing here yet.</p>
        </div>
      )}

      {visible.map((event) => (
        <div className="card" key={event.id}>
          <div className="card__head">
            <span>{event.label}</span>
            <span className="faint num">{new Date(event.at).toLocaleTimeString()}</span>
          </div>
          {event.rolls && event.rolls.length > 0 && (
            <div className="row row--wrap">
              {event.rolls.map((r, i) => (
                <span key={i} className="badge num">
                  {r.label}: {r.raw}
                  {r.formula ? ` → ${r.value}` : ''}
                  {r.entered ? ' (entered)' : ''}
                </span>
              ))}
            </div>
          )}
          {event.note && <p className="faint" style={{ margin: '0.4rem 0 0' }}>{event.note}</p>}
        </div>
      ))}
    </>
  )
}
