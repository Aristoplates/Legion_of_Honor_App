/**
 * The digital replacement for the paper Grognard Sheet and its counters.
 * Every value is directly editable (StatStepper's tap-to-set) — the sheet
 * must never block on a card result the rules engine doesn't know about yet.
 */
import { loadGameData } from '../../data'
import {
  findCommand,
  findOffice,
  findTitle,
  maxLohLevel,
  maxStandingIndex,
  mustRank,
  ranksInOrder,
} from '../../data/lookups'
import { createEvent, mustGrognard } from '../../domain/events'
import { mistressesOf, standingLabel, wifeOf } from '../../domain/selectors'
import type { Convalescence } from '../../domain/types'
import { useGameStore } from '../../store/gameStore'
import { StatStepper } from '../components/StatStepper'

interface GrognardSheetScreenProps {
  grognardId: string
  onBack: () => void
}

export function GrognardSheetScreen({ grognardId, onBack }: GrognardSheetScreenProps) {
  const data = loadGameData()
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const g = mustGrognard(state, grognardId)

  const label = (suffix: string) => `${g.name}: ${suffix}`

  function statDelta(key: 'n' | 'g' | 'e' | 'h' | 'c' | 'f', delta: number) {
    dispatch(
      createEvent(
        { type: 'STAT_DELTA', grognardId, changes: { [key]: delta } },
        { label: label(`${key.toUpperCase()} ${delta > 0 ? '+' : ''}${delta}`), subjects: [grognardId] },
      ),
    )
  }

  function statSet(key: 'n' | 'g' | 'e' | 'h' | 'c' | 'f', value: number) {
    dispatch(
      createEvent(
        { type: 'STAT_SET', grognardId, changes: { [key]: value } },
        { label: label(`${key.toUpperCase()} set to ${value}`), subjects: [grognardId] },
      ),
    )
  }

  function moneyDelta(key: 'paris' | 'purse', delta: number) {
    dispatch(
      createEvent(
        { type: 'MONEY_DELTA', grognardId, changes: { [key]: delta } },
        { label: label(`Money (${key}) ${delta > 0 ? '+' : ''}${delta}`), subjects: [grognardId] },
      ),
    )
  }

  function moneySet(key: 'paris' | 'purse', value: number) {
    dispatch(
      createEvent(
        { type: 'MONEY_SET', grognardId, changes: { [key]: value } },
        { label: label(`Money (${key}) set to ${value}`), subjects: [grognardId] },
      ),
    )
  }

  function standingDelta(delta: number) {
    dispatch(
      createEvent(
        { type: 'STANDING_DELTA', grognardId, delta, maxIndex: maxStandingIndex(data) },
        { label: label(`Standing ${delta > 0 ? '+' : ''}${delta}`), subjects: [grognardId] },
      ),
    )
  }

  function lohDelta(delta: number) {
    dispatch(
      createEvent(
        { type: 'LOH_LEVEL_DELTA', grognardId, delta, maxLevel: maxLohLevel(data) },
        { label: label(`Legion of Honor ${delta > 0 ? '+' : ''}${delta}`), subjects: [grognardId] },
      ),
    )
  }

  function setRank(rankId: string) {
    dispatch(
      createEvent(
        { type: 'RANK_SET', grognardId, rankId },
        { label: label(`Rank set to ${mustRank(data, rankId).name}`), subjects: [grognardId] },
      ),
    )
  }

  function setCommand(commandId: string) {
    dispatch(
      createEvent(
        { type: 'COMMAND_SET', grognardId, commandId: commandId === '' ? null : commandId },
        {
          label: label(
            commandId === '' ? 'Removed from any Command' : `Assigned to ${findCommand(data, commandId)?.name}`,
          ),
          subjects: [grognardId],
        },
      ),
    )
  }

  function setOffice(officeId: string) {
    dispatch(
      createEvent(
        { type: 'OFFICE_SET', grognardId, officeId: officeId === '' ? null : officeId },
        {
          label: label(officeId === '' ? 'Lost Office' : `Appointed ${findOffice(data, officeId)?.name}`),
          subjects: [grognardId],
        },
      ),
    )
  }

  function toggleStatus(key: 'prisoner' | 'retired' | 'furlough' | 'dead') {
    dispatch(
      createEvent(
        { type: 'STATUS_SET', grognardId, changes: { [key]: !g.status[key] } },
        { label: label(`${key} ${!g.status[key] ? 'set' : 'cleared'}`), subjects: [grognardId] },
      ),
    )
  }

  function setConvalescence(convalescence: Convalescence | null) {
    dispatch(
      createEvent(
        { type: 'CONVALESCENCE_SET', grognardId, convalescence },
        {
          label: label(convalescence ? `Convalescing (${convalescence.woundLevelId})` : 'Recovered'),
          subjects: [grognardId],
        },
      ),
    )
  }

  function awardTitle(titleId: string) {
    if (!titleId) return
    dispatch(
      createEvent(
        { type: 'TITLE_AWARDED', grognardId, titleId },
        { label: label(`Awarded ${findTitle(data, titleId)?.name}`), subjects: [grognardId] },
      ),
    )
  }

  function removeTitle(titleId: string) {
    dispatch(
      createEvent(
        { type: 'TITLE_REMOVED', grognardId, titleId },
        { label: label(`Lost ${findTitle(data, titleId)?.name}`), subjects: [grognardId] },
      ),
    )
  }

  const wife = wifeOf(state, g)
  const mistresses = mistressesOf(state, g)
  const convalescingLevels = data.wounds.levels.filter((l) => l.causesConvalescence)

  return (
    <>
      <div className="card">
        <div className="row">
          <button className="btn" onClick={onBack}>
            ← Party
          </button>
          <span className="spacer" />
          <span
            style={{ width: 12, height: 12, borderRadius: '50%', background: g.color, display: 'inline-block' }}
          />
          <h2 style={{ marginLeft: '0.4rem' }}>{g.name}</h2>
        </div>
      </div>

      <div className="card">
        <h3>Stats</h3>
        <StatStepper label="N" value={g.stats.n} onDelta={(d) => statDelta('n', d)} onSet={(v) => statSet('n', v)} />
        <StatStepper label="G" value={g.stats.g} onDelta={(d) => statDelta('g', d)} onSet={(v) => statSet('g', v)} />
        <StatStepper label="E" value={g.stats.e} onDelta={(d) => statDelta('e', d)} onSet={(v) => statSet('e', v)} />
        <StatStepper label="H" value={g.stats.h} onDelta={(d) => statDelta('h', d)} onSet={(v) => statSet('h', v)} />
        <StatStepper label="C" value={g.stats.c} onDelta={(d) => statDelta('c', d)} onSet={(v) => statSet('c', v)} />
        <StatStepper label="F" value={g.stats.f} onDelta={(d) => statDelta('f', d)} onSet={(v) => statSet('f', v)} />
      </div>

      <div className="card">
        <h3>Money</h3>
        <StatStepper
          label="Paris"
          value={g.money.paris}
          steps={[-50, -10, 10, 50]}
          onDelta={(d) => moneyDelta('paris', d)}
          onSet={(v) => moneySet('paris', v)}
        />
        <StatStepper
          label="Purse"
          value={g.money.purse}
          steps={[-50, -10, 10, 50]}
          onDelta={(d) => moneyDelta('purse', d)}
          onSet={(v) => moneySet('purse', v)}
        />
      </div>

      <div className="card">
        <h3>Standing &amp; Legion of Honor</h3>
        <div className="row" style={{ marginBottom: '0.4rem' }}>
          <span className="muted" style={{ width: '5rem' }}>
            Standing
          </span>
          <button className="btn" disabled={g.hasHatCounter} onClick={() => standingDelta(-1)}>
            −
          </button>
          <span className="num" style={{ width: '4rem', textAlign: 'center' }}>
            {standingLabel(data, g)}
          </span>
          <button className="btn" disabled={g.hasHatCounter} onClick={() => standingDelta(1)}>
            +
          </button>
          {g.hasHatCounter && <span className="badge badge--gold">frozen (hat)</span>}
        </div>
        <div className="row">
          <span className="muted" style={{ width: '5rem' }}>
            LoH
          </span>
          <button className="btn" onClick={() => lohDelta(-1)}>
            −
          </button>
          <span className="num" style={{ width: '4rem', textAlign: 'center' }}>
            {g.lohLevel}
          </span>
          <button className="btn" onClick={() => lohDelta(1)}>
            +
          </button>
          <span className="badge">{state.lohBenefitsActive ? 'revealed' : 'face down'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Rank &amp; Command</h3>
        <div className="row" style={{ marginBottom: '0.4rem' }}>
          <span className="muted" style={{ width: '5rem' }}>
            Rank
          </span>
          <select value={g.rank} onChange={(e) => setRank(e.target.value)} className="btn" style={{ flex: 1 }}>
            {ranksInOrder(data).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="muted" style={{ width: '5rem' }}>
            Command
          </span>
          <select
            value={g.commandId ?? ''}
            onChange={(e) => setCommand(e.target.value)}
            className="btn"
            style={{ flex: 1 }}
          >
            <option value="">— none (Army Staff) —</option>
            {data.commands.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Titles</h3>
        {g.titleIds.length === 0 && <p className="faint">None.</p>}
        {g.titleIds.map((id) => (
          <div className="row" key={id} style={{ marginBottom: '0.3rem' }}>
            <span className="spacer">{findTitle(data, id)?.name ?? id}</span>
            <button className="btn btn--danger" onClick={() => removeTitle(id)}>
              Remove
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: '0.4rem' }}>
          <select className="btn" style={{ flex: 1 }} defaultValue="" onChange={(e) => awardTitle(e.target.value)}>
            <option value="">Award title…</option>
            {data.titles
              .filter((t) => !g.titleIds.includes(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Office</h3>
        <div className="row" style={{ marginBottom: '0.4rem' }}>
          <select
            value={g.officeId ?? ''}
            onChange={(e) => setOffice(e.target.value)}
            className="btn"
            style={{ flex: 1 }}
            disabled={g.officeBarredForLife}
          >
            <option value="">— none —</option>
            {data.offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {g.officeBarredForLife && <span className="badge badge--danger">Barred for life (Corruption)</span>}
        {!g.officeBarredForLife && (
          <button
            className="btn btn--danger"
            onClick={() =>
              dispatch(
                createEvent(
                  { type: 'OFFICE_BARRED_FOR_LIFE', grognardId },
                  { label: label('Found Out — barred from Office for life'), subjects: [grognardId] },
                ),
              )
            }
          >
            Found Out (Corruption)
          </button>
        )}
      </div>

      <div className="card">
        <h3>Status</h3>
        <label className="row" style={{ marginBottom: '0.3rem' }}>
          <input type="checkbox" checked={g.status.prisoner} onChange={() => toggleStatus('prisoner')} />
          <span>Prisoner</span>
        </label>
        <label className="row" style={{ marginBottom: '0.3rem' }}>
          <input type="checkbox" checked={g.status.furlough} onChange={() => toggleStatus('furlough')} />
          <span>Furlough</span>
        </label>
        <label className="row" style={{ marginBottom: '0.3rem' }}>
          <input type="checkbox" checked={g.status.retired} onChange={() => toggleStatus('retired')} />
          <span>Retired</span>
        </label>
        <label className="row" style={{ marginBottom: '0.5rem' }}>
          <input type="checkbox" checked={g.status.dead} onChange={() => toggleStatus('dead')} />
          <span>Dead</span>
        </label>

        <div className="row" style={{ marginBottom: '0.3rem' }}>
          <span className="muted">Convalescence</span>
          <span className="spacer" />
          {g.status.convalescence && (
            <span className="badge badge--warn">
              {g.status.convalescence.woundLevelId} · round {g.status.convalescence.fullRounds}
            </span>
          )}
        </div>
        <div className="row row--wrap">
          {convalescingLevels.map((lvl) => (
            <button
              key={lvl.id}
              className="btn"
              onClick={() => setConvalescence({ woundLevelId: lvl.id, fullRounds: 0 })}
            >
              {lvl.name}
            </button>
          ))}
          {g.status.convalescence && (
            <button className="btn btn--primary" onClick={() => setConvalescence(null)}>
              Recovered
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Other</h3>
        <StatStepper
          label="Wounds"
          value={g.woundsSinceDeath}
          steps={[-1, 1]}
          onDelta={(d) =>
            dispatch(
              createEvent(
                { type: 'WOUND_RECORDED', grognardId, fromDuel: d < 0 },
                { label: label('Wounds since death adjusted'), subjects: [grognardId] },
              ),
            )
          }
        />
        <label className="row" style={{ marginBottom: '0.3rem' }}>
          <input
            type="checkbox"
            checked={g.indiscretionThisCS}
            onChange={() =>
              dispatch(
                createEvent(
                  { type: 'INDISCRETION_SET', grognardId, value: !g.indiscretionThisCS },
                  { label: label('Indiscretion toggled'), subjects: [grognardId] },
                ),
              )
            }
          />
          <span>Indiscretion this Campaign Season</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={g.bonapartist}
            onChange={() =>
              dispatch(
                createEvent(
                  { type: 'BONAPARTIST_SET', grognardId, value: !g.bonapartist },
                  { label: label('Bonapartist declaration toggled'), subjects: [grognardId] },
                ),
              )
            }
          />
          <span>Declared Bonapartist (Card 38)</span>
        </label>
      </div>

      {(wife || mistresses.length > 0) && (
        <div className="card">
          <h3>Fair Sex</h3>
          {wife && <p className="muted">Wife: {wife.name}</p>}
          {mistresses.map((m) => (
            <p className="muted" key={m.id}>
              Mistress: {m.name}
            </p>
          ))}
        </div>
      )}
    </>
  )
}
