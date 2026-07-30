/**
 * Lets the player see, without opening the source files, which play-aid
 * tables are still placeholders and what the app cannot do until they are
 * filled in. Doubles as a sanity check after editing a data file: a schema or
 * consistency error is shown here instead of only in the browser console.
 */
import { useMemo } from 'react'
import { GameDataError, dataGaps, loadGameData } from '../../data'

export function TablesScreen() {
  const result = useMemo(() => {
    try {
      return { data: loadGameData(), error: null as GameDataError | null }
    } catch (error) {
      if (error instanceof GameDataError) return { data: null, error }
      throw error
    }
  }, [])

  if (result.error) {
    return (
      <div className="card">
        <div className="card__head">
          <h2>Game Data Error</h2>
          <span className="badge badge--danger">invalid</span>
        </div>
        <p className="muted">
          One of the files under <code>src/data</code> does not match its schema.
        </p>
        <pre
          className="faint"
          style={{ whiteSpace: 'pre-wrap', margin: 0 }}
        >
          {result.error.issues.join('\n')}
        </pre>
      </div>
    )
  }

  const gaps = dataGaps(result.data!)

  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2>Game Data</h2>
          <span className="badge">{gaps.length} gap{gaps.length === 1 ? '' : 's'}</span>
        </div>
        <p className="muted">
          Tables below are still placeholders. Wherever a rule needs one of them,
          the app asks you for the value instead of guessing.
        </p>
      </div>

      {gaps.length === 0 && (
        <div className="card">
          <p className="muted">All tracked tables have data. Nothing pending.</p>
        </div>
      )}

      {gaps.map((gap) => (
        <div className="card" key={`${gap.table}:${gap.what}`}>
          <div className="card__head">
            <h3>{gap.what}</h3>
            <span className="badge badge--warn">{gap.table}</span>
          </div>
          <p className="faint" style={{ margin: 0 }}>
            {gap.impact}
          </p>
        </div>
      ))}
    </>
  )
}
