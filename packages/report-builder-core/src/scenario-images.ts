/**
 * The builder scenarios about images a person adds (0033): Add image…,
 * the file handed to the input it opens, what the live region says, what
 * the report declares and what the host kept, the palette's Image drawing
 * the image just added, and Remove for an image nothing draws. A runner
 * makes a scenario's editor with the store `scenarioStore` gives it, and
 * checks `kept` against what that store kept.
 *
 * The files are bytes written out here, and ship in the dist with the
 * scenarios: a 2 × 1 PNG, a GIF named as a PNG, and an SVG holding what
 * cleaning removes.
 */
import type { AssetRef, ReportDefinition } from '@formancy/report-spec'
import type { AddedImage, ImageStore } from './image-store.js'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioFile, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

/**
 * A PNG of 2 × 1 pixels, 8-bit RGB, one blue (#1f4e79) and one white: 72
 * bytes, written out by a script on 19 October 2026 so that nothing here
 * depends on an encoder, its image data the one scanline deflated by Node
 * 24.21's zlib at level 9, and its CRCs zlib's.
 */
export const SCENARIO_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x7b, 0x40, 0xe8, 0xdd, 0x00, 0x00, 0x00, 0x0f, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x90, 0xf7, 0xab, 0xfc, 0xff, 0xff, 0x3f, 0x00,
  0x0a, 0x25, 0x03, 0xe4, 0x43, 0x30, 0xb2, 0xcf, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

/** Its SHA-256, by node:crypto, pinned rather than taken by the code a scenario checks: the first scenario holds `assetDigest` to it. */
export const SCENARIO_PNG_DIGEST = 'sha256:6ac4fc4e1a8f3a736a3d98d6396251692d4ff7ffaffa9887572ab5f80a0249fc'

/** A GIF's signature and its smallest screen: an image, and none the report prints. */
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b])

/** A mark of a blue band and a white disc, with what cleaning removes: the XML declaration, a comment, metadata and a script. ASCII, so its bytes are its characters. */
const MARK = `<?xml version="1.0" encoding="UTF-8"?>
<!-- An invented firm's mark -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20">
  <metadata>Drawn for the builder scenarios</metadata>
  <script>alert(1)</script>
  <rect width="40" height="20" fill="#1f4e79"/>
  <circle cx="20" cy="10" r="6" fill="#ffffff"/>
</svg>
`

const PNG_FILE: ScenarioFile = { name: 'logo.png', type: 'image/png', bytes: SCENARIO_PNG }
/** Named and typed as a browser would type it from its name: an accept filter lets it through, and only its bytes say what it is. */
const GIF_FILE: ScenarioFile = { name: 'logo.png', type: 'image/png', bytes: GIF }
const SVG_FILE: ScenarioFile = { name: 'logo.svg', type: 'image/svg+xml', bytes: Uint8Array.from(MARK, (char) => char.charCodeAt(0)) }

/** What a scenario's store says when it refuses: the host's words, the same in every language the editor speaks. */
export const SCENARIO_REFUSAL = 'This library keeps no images today.'

/** A scenario's store, and what it kept, in order. */
export interface ScenarioStore {
  readonly store: ImageStore
  readonly kept: readonly AddedImage[]
}

/** The store `scenario`'s editor is made with -- keeping every image, or refusing each with `SCENARIO_REFUSAL` -- or undefined for a scenario with none. */
export function scenarioStore(scenario: BuilderScenario): ScenarioStore | undefined {
  if (scenario.store === undefined) return undefined
  const kept: AddedImage[] = []
  const keeps = scenario.store === 'keeps'
  return {
    kept,
    store: {
      async keep(image) {
        if (!keeps) return { ok: false, message: SCENARIO_REFUSAL }
        kept.push(image)
        return { ok: true }
      },
    },
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, at) => byte === b[at])

/** Whether `bytes` are the mark as cleaning writes it: the drawing alone, without a byte of what it removed. */
function cleanedMark(bytes: Uint8Array): boolean {
  const text = String.fromCharCode(...bytes)
  return text.startsWith('<svg') && text.includes('<circle') && !['<?xml', '<!--', 'metadata', 'script', 'alert'].some((removed) => text.includes(removed))
}

const ids = (report: ReportDefinition): string => report.assets.map((asset) => asset.id).join()

const drawsLogo = (report: ReportDefinition): boolean =>
  report.regions.reportHeader.some((component) => component.kind === 'image' && component.source.kind === 'asset' && component.source.asset === 'logo')

const drawsNothing = (report: ReportDefinition): boolean =>
  Object.values(report.regions).every((components) => components.every((component) => component.kind !== 'image'))

/** The scenario report with two images, the scenario PNG as `logo`, drawn in the report header, and `unused`, which nothing draws. */
function twoImages(): ReportDefinition {
  const report = scenarioReport()
  const assets: AssetRef[] = [
    { id: 'logo', mediaType: 'image/png', digest: SCENARIO_PNG_DIGEST },
    { id: 'unused', mediaType: 'image/png', digest: `sha256:${'5e'.repeat(32)}` },
  ]
  return {
    ...report,
    assets,
    regions: {
      ...report.regions,
      reportHeader: [{ id: 'logo-image', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }],
    },
  }
}

/** The image scenarios, their names in `locale`. */
export function imageScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const add = button(t('images.add'))
  const image = button(t('kind.image'))
  const remove = (id: string): ScenarioQuery => button(t('images.removeOne', { id }))
  const drawn = t('label.kindDetail', { kind: t('kind.image'), detail: 'logo' })
  const refused = (name: string, reason: string): string => t('images.refused', { name, reason })
  const nothingDeclared = {
    expect: 'document',
    says: 'the report declares no image',
    unchanged: true,
    check: (report: ReportDefinition) => report.assets.length === 0,
  } as const
  const keptNothing = { expect: 'kept', says: 'the host kept nothing', check: (kept: readonly AddedImage[]) => kept.length === 0 } as const
  const scenario = (
    name: string,
    steps: readonly ScenarioStep[],
    store?: BuilderScenario['store'],
    report: () => ReportDefinition = scenarioReport,
  ): BuilderScenario => ({
    name,
    locale,
    report,
    steps,
    ...(store === undefined ? {} : { store }),
  })

  return [
    // The bytes reach the host before the report declares them, in a step
    // of their own; an undo pressed on the image's Remove, which takes its
    // row away, leaves the keyboard on the first field rather than the
    // page, and the redo needs no second keep; the palette's Image, which
    // had nothing to draw, draws the image just added; and two undos take
    // both back.
    scenario(
      'add an image, insert it, and undo both',
      [
        { do: 'click', ...image },
        { expect: 'text', ...said, text: t('palette.addImageFirst', { add: t('images.add') }) },
        { do: 'upload', ...add, file: PNG_FILE },
        { expect: 'focused', ...add },
        { expect: 'text', ...said, text: t('images.added', { id: 'logo', kind: t('kind.image') }) },
        {
          expect: 'document',
          says: 'the report declares logo, by the PNG’s digest',
          check: (report) => JSON.stringify(report.assets) === JSON.stringify([{ id: 'logo', mediaType: 'image/png', digest: SCENARIO_PNG_DIGEST }]),
        },
        {
          expect: 'kept',
          says: 'the host kept the PNG’s bytes as logo',
          check: (kept) => kept.length === 1 && kept[0]?.asset === 'logo' && sameBytes(kept[0].bytes, SCENARIO_PNG),
        },
        { do: 'focus', ...remove('logo') },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'absent', ...remove('logo') },
        { expect: 'focused', role: PROPERTY_ROLES.text, name: t('field.title') },
        { do: 'click', ...button(t('action.redo')) },
        { expect: 'present', ...remove('logo') },
        { expect: 'kept', says: 'the host was asked once, the redo needing no keep', check: (kept) => kept.length === 1 },
        { do: 'focus', ...image },
        { do: 'press', key: 'Enter' },
        { do: 'focus', ...button(t('target.inside', { where: t('region.reportHeader') })) },
        { do: 'press', key: 'Enter' },
        { expect: 'focused', role: 'treeitem', name: drawn, selected: true },
        { expect: 'document', says: 'the report header draws logo', check: drawsLogo },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'document', says: 'the report is as it started', check: (report) => report.assets.length === 0 && drawsNothing(report) },
      ],
      'keeps',
    ),
    // A GIF named as a PNG is refused by what its bytes are, and nothing
    // reaches the host or the report; the keyboard stays where it was.
    scenario(
      'refuse a file that is no image the report prints, whatever its name',
      [
        { do: 'upload', ...add, file: GIF_FILE },
        { expect: 'text', ...said, text: refused('logo.png', t('images.reason.notImage')) },
        { expect: 'focused', ...add },
        nothingDeclared,
        keptNothing,
      ],
      'keeps',
    ),
    // An SVG reaches the host as cleaning wrote it, what never draws gone
    // and said, and is declared as an SVG.
    scenario(
      'add an SVG, cleaned of what never draws',
      [
        { do: 'upload', ...add, file: SVG_FILE },
        {
          expect: 'text',
          ...said,
          text: t('images.cleaned', {
            names: new Intl.ListFormat(locale, { type: 'conjunction' }).format([t('images.svgDeclaration'), t('images.svgComment'), 'metadata', 'script']),
          }),
        },
        {
          expect: 'document',
          says: 'the report declares logo as an SVG',
          check: (report) => report.assets.length === 1 && report.assets[0]?.id === 'logo' && report.assets[0].mediaType === 'image/svg+xml',
        },
        {
          expect: 'kept',
          says: 'the host kept the drawing, without what cleaning removed',
          check: (kept) => kept.length === 1 && kept[0] !== undefined && cleanedMark(kept[0].bytes),
        },
      ],
      'keeps',
    ),
    // The host's refusal is shown in its own words, and the report is left
    // as it was.
    scenario(
      'show the host’s refusal to keep an image, and change nothing',
      [
        { do: 'upload', ...add, file: PNG_FILE },
        { expect: 'text', ...said, text: refused('logo.png', SCENARIO_REFUSAL) },
        { expect: 'focused', ...add },
        nothingDeclared,
        keptNothing,
      ],
      'refuses',
    ),
    // An image nothing draws is removed from the report's properties in one
    // step, and the keyboard goes to their first field, as it does when a
    // redo pressed on its Remove takes the row away; one that something
    // draws stays, and pressing its Remove says what draws it.
    scenario(
      'remove an image nothing draws, and keep one something draws',
      [
        { do: 'click', ...remove('unused') },
        { expect: 'document', says: 'the report declares logo alone', check: (report) => ids(report) === 'logo' },
        { expect: 'focused', role: PROPERTY_ROLES.text, name: t('field.title') },
        { expect: 'text', ...said, text: t('images.removed', { id: 'unused' }) },
        { expect: 'absent', ...remove('unused') },
        { do: 'click', ...remove('logo') },
        { expect: 'text', ...said, text: t('images.inUse', { names: drawn }) },
        { expect: 'focused', ...remove('logo') },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'document', says: 'both images are declared again', check: (report) => ids(report) === 'logo,unused' },
        { expect: 'present', ...remove('unused') },
        { do: 'focus', ...remove('unused') },
        { do: 'press', key: 'y', modifiers: ['Control'] },
        { expect: 'absent', ...remove('unused') },
        { expect: 'focused', role: PROPERTY_ROLES.text, name: t('field.title') },
      ],
      undefined,
      twoImages,
    ),
    // Where the host keeps no images there is no Add image…, and the
    // palette's Image says what the report must declare instead.
    scenario('offer no Add image… where the host keeps no images', [
      { expect: 'absent', ...add },
      { do: 'click', ...image },
      { expect: 'text', ...said, text: t('palette.needsImage') },
      { expect: 'document', says: 'the report draws no image', unchanged: true, check: drawsNothing },
    ]),
  ]
}
