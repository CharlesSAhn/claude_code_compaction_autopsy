/**
 * UI copy for the autopsy panel. `HEALTHY_LINE` is the one UI-owned fixed string (spec, "Words");
 * the two contract strings render only from `INCONSISTENT_LABEL` and `CLOSING_LINE` in the domain.
 * "not checkable" is the UI phrase for `none_matchable`, "none found" for `none_found`.
 */
export const HEALTHY_LINE = 'No downstream action inconsistent with tracked information was observed.'

export const NOT_CHECKABLE = 'not checkable'
export const NONE_FOUND = 'none found'
export const NOT_RESTATED = 'not restated'
export const NO_ANCHOR = 'no anchor'
export const NO_SECTION = 'no constraints section matched'
export const NONE = 'none'
export const START_HERE = 'Start here: click the compaction.'

/** Why a `none_matchable` item could not be checked, by item class (spec, trace step 3). */
export const NOT_CHECKABLE_REASON = {
  fact: 'a fact has no anchor',
  positive: 'a positive rule has no anchor',
  negation: 'no concrete or class anchor in the trigger clause',
} as const

export const WINDOW_END_OF_SESSION = 'until the end of the session'
export const windowNextCompaction = (ts: string): string => `until the next compaction at ${ts}`

export const QUESTIONS = [
  'What was there',
  'What survived',
  'What was lost or weakened',
  'Where it came from',
  'What happened after',
] as const

export const ORIGIN_LINE = 'every item links to its prompt: uuid, time, JSONL line'
