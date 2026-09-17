/**
 * Mounts the shell over the session source. Until T2-engine lands, the source comes from the
 * temporary stub (src/ui/stub-analyze.ts); T4-autopsy replaces it with the analyzed source.
 */
import { App as Shell } from './ui/app/App.tsx'
import { stubSource } from './ui/stub-analyze.ts'

export { App as Shell, type AppProps } from './ui/app/App.tsx'
export { Header } from './ui/app/Header.tsx'
export { AutopsySlot, StorySlot } from './ui/app/slots.tsx'
export { Timeline } from './ui/timeline/Timeline.tsx'

function App() {
  return <Shell source={stubSource} />
}

export default App
