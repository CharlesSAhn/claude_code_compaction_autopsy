export const FOOTER_LINE =
  "Demo data is illustrative. Items are pre-labeled; the README says what the analysis does and doesn't do."
export const README_URL = 'https://github.com/CharlesSAhn/claude_code_compaction_autopsy#readme'

export function Footer() {
  return (
    <footer className="footer">
      {FOOTER_LINE}{' '}
      <a href={README_URL}>README</a>
    </footer>
  )
}
