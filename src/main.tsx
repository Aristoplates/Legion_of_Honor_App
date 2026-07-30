import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { hydrateGameStore } from './store/gameStore'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root missing from index.html')

const root = createRoot(container)

// Render only after the persisted save (if any) has loaded, so the app never
// briefly shows an empty party before swapping in the real one.
void hydrateGameStore().then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
