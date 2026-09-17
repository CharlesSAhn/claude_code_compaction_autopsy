/**
 * Placeholders where T4-autopsy mounts the autopsy panel and the story view. Both say so.
 */
export const NOT_ANALYZED = 'not analyzed in this build'

export function AutopsySlot() {
  return (
    <section className="slot slot--autopsy" aria-label="Autopsy panel">
      <h2 className="slot__title">Autopsy</h2>
      <p className="slot__note">{NOT_ANALYZED}</p>
    </section>
  )
}

export function StorySlot() {
  return (
    <section className="slot slot--story" aria-label="Story view">
      <h2 className="slot__title">Story</h2>
      <p className="slot__note">{NOT_ANALYZED}</p>
    </section>
  )
}
