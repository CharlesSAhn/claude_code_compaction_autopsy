/**
 * Mounts the shell over the analyzed fixture source (src/source.ts). T4-autopsy mounts the
 * panels into the slots.
 */
import { analyzedSource } from './source.ts'
import { App as Shell } from './ui/app/App.tsx'

export { App as Shell, type AppProps } from './ui/app/App.tsx'
export { Header } from './ui/app/Header.tsx'
export { AutopsySlot, StorySlot } from './ui/app/slots.tsx'
export { Timeline } from './ui/timeline/Timeline.tsx'

function App() {
  return <Shell source={analyzedSource} />
}

export default App
