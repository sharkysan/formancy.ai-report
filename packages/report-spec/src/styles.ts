/**
 * Print styles: the report's own serialisable tokens for how its text
 * prints, never CSS -- the font families and alignments the format names,
 * a style, and a style applied when a condition holds.
 */
import type { Expression } from './values.js'

export const FONT_FAMILIES = ['sans', 'serif', 'mono'] as const
export type FontFamily = (typeof FONT_FAMILIES)[number]

export const ALIGNMENTS = ['left', 'center', 'right'] as const
export type Alignment = (typeof ALIGNMENTS)[number]

/**
 * A print style: serialisable report tokens, never CSS. Nothing from the
 * editor's or the host's stylesheet reaches a printed page; what prints is
 * what these say (plan 11.4). An absent property is the renderer's default.
 */
export interface PrintStyle {
  readonly id: string
  readonly font?: FontFamily
  /** Points. */
  readonly size?: number
  readonly bold?: boolean
  readonly italic?: boolean
  /** Lower-case `#rrggbb`. */
  readonly color?: string
  readonly align?: Alignment
}

/** A style applied when a condition holds: each rule that holds applies its style over the base one, in order, a later rule's property winning. */
export interface StyleRule {
  readonly when: Expression
  /** A `PrintStyle` id. */
  readonly style: string
}
