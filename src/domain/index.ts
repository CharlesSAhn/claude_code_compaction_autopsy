/**
 * Public entry point of the domain.
 *
 * Everything outside src/domain imports from here and nowhere deeper.
 * The domain is pure analysis: it depends on nothing else in src and on no packages.
 */
export const DOMAIN_NAME = 'Compaction Autopsy'

export * from './contract'
export { analyze } from './analyze'
