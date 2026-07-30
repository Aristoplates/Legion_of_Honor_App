/**
 * Walks Booklet Setup Section A "Grognard Sheet" for one new Grognard: name
 * and colour, then the ten rolls in the order the sheet lists them. Confirming
 * the last roll creates the Grognard and hands control back to the caller.
 */
import { useMemo, useState } from 'react'
import { loadGameData } from '../../data'
import { findCommand, mustRank } from '../../data/lookups'
import { createEvent } from '../../domain/events'
import { createGrognard, GROGNARD_COLORS } from '../../domain/factories'
import { SETUP_FORMULAS, hasAssignmentTable, startingAssignment, startingHealth, startingRankId } from '../../domain/rules/setup'
import { useGameStore } from '../../store/gameStore'
import { RollPrompt, type RollPromptResult } from './RollPrompt'

interface StepDef {
  key: keyof typeof SETUP_FORMULAS
  title: string
  hint?: string
  postProcess?: (value: number) => number
  resultLabel?: (finalValue: number, rawRollValue: number) => string
}

function useSteps(): StepDef[] {
  const data = loadGameData()
  return useMemo<StepDef[]>(
    () => [
      {
        key: 'assignment',
        title: 'Assignment',
        hint: hasAssignmentTable(data)
          ? undefined
          : 'Assignment Sheet is not filled in yet — pick a Command yourself once rolled.',
        resultLabel: (_final, raw) => {
          const commandId = startingAssignment(data, raw)
          if (!commandId) return `Roll ${raw} — no Assignment Sheet entry yet, choose manually`
          return `→ ${findCommand(data, commandId)?.name ?? commandId}`
        },
      },
      {
        key: 'rank',
        title: 'Rank',
        hint: '[1..5] = Sergent, [6..10] = Sous-Lieutenant',
        resultLabel: (_final, raw) => {
          const rankId = startingRankId(raw)
          return `→ ${mustRank(data, rankId).name}`
        },
      },
      { key: 'notice', title: "Napoleon's Notice" },
      { key: 'glory', title: 'Glory' },
      { key: 'experience', title: 'Experience' },
      { key: 'moneyParis', title: 'Money — Paris' },
      { key: 'moneyPurse', title: 'Money — Purse' },
      {
        key: 'health',
        title: 'Health',
        hint: '100 − 1D10',
        postProcess: startingHealth,
      },
      { key: 'charm', title: 'Charm' },
      { key: 'fencing', title: 'Fencing' },
    ],
    [data],
  )
}

interface GrognardWizardProps {
  onDone: () => void
  onCancel: () => void
}

export function GrognardWizard({ onDone, onCancel }: GrognardWizardProps) {
  const data = loadGameData()
  const dispatch = useGameStore((s) => s.dispatch)
  const existingCount = useGameStore((s) => Object.keys(s.state.grognards).length)
  const steps = useSteps()

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(GROGNARD_COLORS[existingCount % GROGNARD_COLORS.length]!)
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState<Partial<Record<keyof typeof SETUP_FORMULAS, RollPromptResult>>>(
    {},
  )

  const trimmedName = name.trim()

  if (!nameConfirmed) {
    return (
      <div className="card">
        <div className="card__head">
          <h2>New Grognard</h2>
        </div>
        <p className="muted">Name and counter colour.</p>
        <input
          className="btn"
          style={{ width: '100%', marginBottom: '0.5rem' }}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="row row--wrap" style={{ marginBottom: '0.75rem' }}>
          {GROGNARD_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: c,
                border: c === color ? '3px solid var(--text)' : '1px solid var(--border-strong)',
                padding: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div className="row">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <span className="spacer" />
          <button
            className="btn btn--primary"
            disabled={trimmedName.length === 0}
            onClick={() => setNameConfirmed(true)}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  const step = steps[stepIndex]
  // Should not happen: the last confirm below finishes the wizard itself
  // rather than falling through to a step-less render.
  if (!step) return null

  // Building the Grognard from a "step became undefined" render branch would
  // dispatch (and call onDone, which sets the parent's state) during render —
  // React flags that as an error. Finishing on the last Confirm click instead
  // keeps it inside the event handler, where state updates belong.
  function finish(merged: typeof values) {
    const rankId = startingRankId(merged.rank!.rawRollValue)
    const commandId = startingAssignment(data, merged.assignment!.rawRollValue) ?? null

    const grognard = createGrognard({
      name: trimmedName,
      color,
      rank: rankId,
      stats: {
        n: merged.notice!.final,
        g: merged.glory!.final,
        e: merged.experience!.final,
        h: merged.health!.final,
        c: merged.charm!.final,
        f: merged.fencing!.final,
      },
      money: { paris: merged.moneyParis!.final, purse: merged.moneyPurse!.final },
      standingIndex: data.standing.defaultIndex,
      commandId,
    })

    dispatch(
      createEvent(
        { type: 'GROGNARD_ADDED', grognard },
        { label: `${trimmedName} joins the army`, subjects: [grognard.id] },
      ),
    )
    onDone()
  }

  return (
    <RollPrompt
      key={step.key}
      title={`${trimmedName}: ${step.title}`}
      formula={SETUP_FORMULAS[step.key]}
      hint={step.hint}
      postProcess={step.postProcess}
      resultLabel={step.resultLabel}
      onConfirm={(result) => {
        const merged = { ...values, [step.key]: result }
        if (stepIndex + 1 >= steps.length) {
          finish(merged)
        } else {
          setValues(merged)
          setStepIndex((i) => i + 1)
        }
      }}
    />
  )
}
