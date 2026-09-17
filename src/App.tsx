/**
 * Mounts the shell over the analyzed fixture source (src/source.ts): `analyze` ran on every
 * fixture at load, the source carries the verdicts, and the shell gets the reports by session id.
 */
import { analyzedSessions, analyzedSource } from './source.ts'
import { App as Shell } from './ui/app/App.tsx'

export { App as Shell, type AppProps } from './ui/app/App.tsx'
export { Header } from './ui/app/Header.tsx'
export { AutopsyPanel, EvidenceDrawer, HEALTHY_LINE } from './ui/autopsy/index.ts'
export { StoryView } from './ui/story/index.ts'
export { Timeline } from './ui/timeline/Timeline.tsx'

function App() {
  return <Shell source={analyzedSource} analyzed={analyzedSessions} />
}

export default App
