import { useState, type ReactNode } from 'react'
import { GrognardSheetScreen } from './ui/screens/GrognardSheetScreen'
import { LogScreen } from './ui/screens/LogScreen'
import { PartyScreen } from './ui/screens/PartyScreen'
import { TablesScreen } from './ui/screens/TablesScreen'

const TABS = ['Party', 'Sequence', 'Ladies', 'Log', 'Tables'] as const
type Tab = (typeof TABS)[number]

function Placeholder({ tab }: { tab: Tab }) {
  return (
    <div className="card">
      <div className="card__head">
        <h2>{tab}</h2>
        <span className="badge">not built yet</span>
      </div>
      <p className="muted">Scaffold is running. Screens are added milestone by milestone.</p>
    </div>
  )
}

export function App() {
  const [tab, setTab] = useState<Tab>('Party')
  const [openGrognardId, setOpenGrognardId] = useState<string | null>(null)

  // Leaving the Party tab always drops back to the roster, not a stale sheet.
  function selectTab(next: Tab) {
    if (next !== 'Party') setOpenGrognardId(null)
    setTab(next)
  }

  let content: ReactNode
  if (tab === 'Party') {
    content = openGrognardId ? (
      <GrognardSheetScreen grognardId={openGrognardId} onBack={() => setOpenGrognardId(null)} />
    ) : (
      <PartyScreen onOpenGrognard={setOpenGrognardId} />
    )
  } else if (tab === 'Tables') {
    content = <TablesScreen />
  } else if (tab === 'Log') {
    content = <LogScreen />
  } else {
    content = <Placeholder tab={tab} />
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>Legion of Honor</h1>
          <div className="app__subtitle">Grognard Tracker</div>
        </div>
      </header>

      <main className="app__main">{content}</main>

      <nav className="app__nav">
        {TABS.map((t) => (
          <button key={t} onClick={() => selectTab(t)} aria-current={t === tab ? 'page' : undefined}>
            {t}
          </button>
        ))}
      </nav>
    </div>
  )
}
