/**
 * The app-wide store: the event log, the folded GameState derived from it, and
 * persistence to IndexedDB.
 *
 * Snapshots every SNAPSHOT_INTERVAL events so replay after a reload does not
 * re-fold the entire history; undo always re-folds from the nearest snapshot,
 * which is cheap because the log between snapshots is short.
 */
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { create } from 'zustand'
import { applyEvent, emptyState, foldEvents, type GameEvent } from '../domain/events'
import type { GameState } from '../domain/types'

const SNAPSHOT_INTERVAL = 50
const STORAGE_KEY = 'legion-of-honor:save'

interface Snapshot {
  /** Index into `events` this snapshot was taken after (exclusive-safe: state after events[0..index]). */
  afterIndex: number
  state: GameState
}

interface PersistedSave {
  schemaVersion: number
  events: GameEvent[]
}

interface GameStoreState {
  /** True once the persisted save has been loaded (or confirmed absent). */
  ready: boolean
  events: GameEvent[]
  state: GameState
  snapshots: Snapshot[]

  dispatch: (event: GameEvent) => void
  dispatchMany: (events: GameEvent[]) => void
  undo: () => void
  canUndo: () => boolean
  resetGame: (name: string) => void
  loadFromSave: (save: PersistedSave) => void
  exportSave: () => PersistedSave
}

function rebuildFromSnapshot(
  initial: GameState,
  events: readonly GameEvent[],
  snapshots: readonly Snapshot[],
): GameState {
  const best = [...snapshots].sort((a, b) => b.afterIndex - a.afterIndex)[0]
  if (!best) return foldEvents(initial, events)
  return foldEvents(best.state, events.slice(best.afterIndex))
}

function persist(events: GameEvent[]): void {
  const save: PersistedSave = { schemaVersion: 1, events }
  // Fire-and-forget: losing the very latest write on a crash is acceptable
  // for a game log that is also exportable by hand.
  void idbSet(STORAGE_KEY, save)
}

const BASE_STATE = emptyState('game_new', 'New Game', '1970-01-01T00:00:00.000Z')

export const useGameStore = create<GameStoreState>((setState, getState) => ({
  ready: false,
  events: [],
  state: BASE_STATE,
  snapshots: [],

  dispatch(event) {
    setState((prev) => {
      const state = applyEvent(prev.state, event)
      const events = [...prev.events, event]
      const snapshots =
        events.length % SNAPSHOT_INTERVAL === 0
          ? [...prev.snapshots, { afterIndex: events.length, state }]
          : prev.snapshots
      persist(events)
      return { state, events, snapshots }
    })
  },

  dispatchMany(newEvents) {
    if (newEvents.length === 0) return
    setState((prev) => {
      let state = prev.state
      const events = [...prev.events]
      const snapshots = [...prev.snapshots]
      for (const event of newEvents) {
        state = applyEvent(state, event)
        events.push(event)
        if (events.length % SNAPSHOT_INTERVAL === 0) {
          snapshots.push({ afterIndex: events.length, state })
        }
      }
      persist(events)
      return { state, events, snapshots }
    })
  },

  undo() {
    setState((prev) => {
      if (prev.events.length === 0) return prev
      const events = prev.events.slice(0, -1)
      const snapshots = prev.snapshots.filter((s) => s.afterIndex <= events.length)
      const state = rebuildFromSnapshot(BASE_STATE, events, snapshots)
      persist(events)
      return { state, events, snapshots }
    })
  },

  canUndo() {
    return getState().events.length > 0
  },

  resetGame(name) {
    const state = emptyState(`game_${Date.now()}`, name, new Date().toISOString())
    persist([])
    setState({ state, events: [], snapshots: [] })
  },

  loadFromSave(save) {
    const state = foldEvents(BASE_STATE, save.events)
    setState({ state, events: save.events, snapshots: [], ready: true })
  },

  exportSave() {
    const { events } = getState()
    return { schemaVersion: 1, events }
  },
}))

/** Loads the persisted save once at startup. Call this before rendering the app. */
export async function hydrateGameStore(): Promise<void> {
  const saved = await idbGet<PersistedSave>(STORAGE_KEY)
  if (saved && saved.schemaVersion === 1) {
    useGameStore.getState().loadFromSave(saved)
  } else {
    useGameStore.setState({ ready: true })
  }
}
