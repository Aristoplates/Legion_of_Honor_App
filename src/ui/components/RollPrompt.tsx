/**
 * One dice step: shows the booklet's formula, rolls on tap, but always also
 * accepts the result of physical dice — the app must never force its own
 * randomness on the table. `postProcess` covers formulas the parser can't
 * express directly (e.g. "100 − 1D10" for starting Health).
 */
import { useState } from 'react'
import { applyFormulaTo, cryptoRng, describeFormula, roll, type RollResult } from '../../domain/rng'

export interface RollPromptResult {
  raw: number
  rawRollValue: number
  final: number
  entered: boolean
}

interface RollPromptProps {
  title: string
  formula: string
  hint?: string
  postProcess?: (value: number) => number
  resultLabel?: (finalValue: number, rawRollValue: number) => string
  onConfirm: (result: RollPromptResult) => void
}

export function RollPrompt({
  title,
  formula,
  hint,
  postProcess,
  resultLabel,
  onConfirm,
}: RollPromptProps) {
  const [result, setResult] = useState<RollResult | null>(null)
  const [entered, setEntered] = useState(false)
  const [manual, setManual] = useState('')
  const [error, setError] = useState<string | null>(null)

  const finalValue = result ? (postProcess ? postProcess(result.value) : result.value) : null

  function rollDice() {
    setResult(roll(formula, cryptoRng))
    setEntered(false)
    setError(null)
  }

  function applyManual() {
    const n = Number(manual)
    if (!Number.isFinite(n)) {
      setError('Enter the number shown on your dice')
      return
    }
    try {
      setResult(applyFormulaTo(formula, n))
      setEntered(true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid roll')
    }
  }

  function redo() {
    setResult(null)
    setManual('')
    setError(null)
  }

  return (
    <div className="card">
      <div className="card__head">
        <h3>{title}</h3>
        <span className="badge num">{describeFormula(formula)}</span>
      </div>
      {hint && (
        <p className="faint" style={{ marginTop: 0 }}>
          {hint}
        </p>
      )}

      {!result && (
        <div className="row row--wrap">
          <button className="btn btn--primary" onClick={rollDice}>
            Roll
          </button>
          <span className="spacer" />
          <input
            className="btn"
            style={{ width: '5rem', textAlign: 'center' }}
            inputMode="numeric"
            placeholder="or enter"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn" onClick={applyManual}>
            Use
          </button>
        </div>
      )}

      {error && <p className="badge badge--danger">{error}</p>}

      {result && finalValue !== null && (
        <>
          <p className="num" style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>
            {result.text}
            {postProcess ? ` → ${finalValue}` : ''}
            {entered ? ' (entered)' : ''}
          </p>
          {resultLabel && <p className="muted">{resultLabel(finalValue, result.value)}</p>}
          <div className="row">
            <button className="btn" onClick={redo}>
              Redo
            </button>
            <span className="spacer" />
            <button
              className="btn btn--primary"
              onClick={() =>
                onConfirm({
                  raw: result.raw,
                  rawRollValue: result.value,
                  final: finalValue,
                  entered,
                })
              }
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  )
}
