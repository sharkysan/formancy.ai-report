/**
 * Where the Studio's Preview stands, and what it is called (0029).
 *
 * Past 128.25rem the design view holds an A4 page whole beside the Preview
 * and both side panes -- measured in Chromium on 16 October 2026: whole in
 * a 2052px window, 2px short at 2049px (0019) -- and there the Preview
 * stands beside the builder. Up to it, it stands in the design view's
 * place, in the builder's middle, with the outline and the properties
 * beside it.
 *
 * The query is written twice, here and in styles/narrow.css, because two
 * readers need it: the workspace, which tells every editor where its
 * Preview stands, and the stylesheet, which gives the builder the row and
 * from which the browser gate and the README pictures' camera read their
 * widths. styles.test.tsx fails when the two differ.
 */
import type { HostViewPlace } from '@formancy/report-builder-core'

/** The window in which the Preview stands in the builder's middle. */
export const MIDDLE = '(max-width: 128.25rem)'

/** The Preview's name: its heading, and the region a builder draws it in. */
export const PREVIEW_NAME = 'Preview'

/** Where the Preview stands while the window answers `MIDDLE` as `room` does. */
export const placeIn = (room: Pick<MediaQueryList, 'matches'>): HostViewPlace => (room.matches ? 'middle' : 'beside')
