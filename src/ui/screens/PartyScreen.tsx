/**
 * The roster. Before a campaign exists this doubles as the setup flow: name
 * the campaign, then add Grognards one at a time exactly as Booklet Setup
 * Section A walks through the Grognard Sheet.
 */
import { useState } from 'react'
import { loadGameData } from '../../data'
import { mustRank } from '../../data/lookups'
import { isAbsent, standingLabel } from '../../domain/selectors'
import type { Grognard } from '../../domain/types'
import { useGameStore } from '../../store/gameStore'
import { GrognardWizard } from '../components/GrognardWizard'
import { NewGameScreen } from './NewGameScreen'

function statusBadges(grognard: Grognard): Array<{ text: string; tone?: 'warn' | 'danger' | 'gold' }> {
  const badges: Array<{ text: string; tone?: 'warn' | 'danger' | 'gold' }> = []
  if (grognard.status.dead) badges.push({ text: 'Dead', tone: 'danger' })
  if (grognard.status.prisoner) badges.push({ text: 'Prisoner', tone: 'warn' })
  if (grognard.status.retired) badges.push({ text: 'Retired' })
  if (grognard.status.furlough) badges.push({ text: 'Furlough' })
  if (grognard.status.convalescence) {
    badges.push({
      text: `Convalescent (R${grognard.status.convalescence.fullRounds})`,
      tone: 'warn',
    })
  }
  return badges
}

interface PartyScreenProps {
  onOpenGrognard: (id: string) => void
}

export function PartyScreen({ onOpenGrognard }: PartyScreenProps) {
  const data = loadGameData()
  const state = useGameStore((s) => s.state)
  const [adding, setAdding] = useState(false)

  const gameStarted = state.id !== 'game_new'
  const grognards = state.seatingOrder
    .map((id) => state.grognards[id])
    .filter((g): g is Grognard => g !== undefined)

  if (!gameStarted) return <NewGameScreen />

  if (adding || grognards.length === 0) {
    return (
      <GrognardWizard
        onDone={() => setAdding(false)}
        onCancel={() => setAdding(false)}
      />
    )
  }

  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2>{state.name}</h2>
          <span className="badge">CS {state.campaignSeason}</span>
        </div>
        <button className="btn btn--primary" onClick={() => setAdding(true)}>
          Add Grognard
        </button>
      </div>

      {grognards.map((g) => {
        const rank = mustRank(data, g.rank)
        const badges = statusBadges(g)
        return (
          <button
            key={g.id}
            className="card"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onOpenGrognard(g.id)}
          >
            <div className="card__head">
              <span className="row" style={{ gap: '0.5rem' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: g.color,
                    display: 'inline-block',
                  }}
                />
                <h3>{g.name}</h3>
              </span>
              <span className="badge badge--gold">{rank.name}</span>
            </div>
            <div className="row row--wrap faint num" style={{ marginBottom: badges.length ? '0.4rem' : 0 }}>
              <span>N {g.stats.n}</span>
              <span>G {g.stats.g}</span>
              <span>E {g.stats.e}</span>
              <span>H {g.stats.h}</span>
              <span>M {g.money.paris + g.money.purse}</span>
              <span>S {standingLabel(data, g)}</span>
              {isAbsent(state, g) && <span className="badge">Absent</span>}
            </div>
            {badges.length > 0 && (
              <div className="row row--wrap">
                {badges.map((b) => (
                  <span key={b.text} className={`badge${b.tone ? ` badge--${b.tone}` : ''}`}>
                    {b.text}
                  </span>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </>
  )
}
