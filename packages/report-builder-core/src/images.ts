/**
 * Adding an image a person chose, and removing one nothing draws (0033):
 * the editor's part between a builder, which hands it a file, and the
 * host's store, which keeps the bytes before the report declares them.
 *
 * What the renderer would refuse at every print is refused here, before
 * the host is asked, by report-spec's own readers and in the editor's
 * words: the file's size before it is read; what its bytes are, never its
 * name or a type a browser guessed; a PNG's or a JPEG's structure and
 * sides; a CMYK JPEG in an e-invoice, whose PDF/A cannot hold one (0031);
 * an SVG whole, cleaned into the drawing that prints (0030). A PNG's image
 * data is not inflated and a JPEG's scan not decoded, which the renderer
 * does at print; and what a report gains after an image is added -- an
 * e-invoice, or the box an SVG is drawn in -- is the renderer's to refuse.
 *
 * An add takes time -- the file is read, the host keeps it -- and the
 * editor's actions are synchronous (0008), so it runs in phases: the file
 * taken, what its bytes are, and what became of it once the host answered.
 * Each phase is one action to the listeners, told once when it is done.
 */
import { addAsset, nextAssetId, removeAsset } from '@formancy/report-core'
import type { Command, CommandOutcome, Refusal } from '@formancy/report-core'
import { ASSET_MEDIA_TYPES, assetDigest, cleanSvg, imageHeader, MAX_ASSET_BYTES, MAX_ASSET_SIDE, MAX_ASSETS, sniffImage, walkComponents } from '@formancy/report-spec'
import type { AssetMediaType, ReportDefinition, SvgRefusalCode, SvgRemoval, SvgRemovalKind } from '@formancy/report-spec'
import { assetBase } from './asset-name.js'
import { stepLabel } from './history.js'
import type { AddedImage, ImageFile, ImageLibrary, ImageStore, KeptImage, LibraryAsset } from './image-store.js'
import { DONE } from './model.js'
import type { EditorOutcome, EditorRefusalCode } from './model.js'
import { refusalMessage } from './properties.js'
import type { Derived, Local } from './state.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** The extensions a file chooser offers beside each type, as files of it are named. */
const EXTENSIONS: { readonly [T in AssetMediaType]: readonly string[] } = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/svg+xml': ['.svg'] }

/** Each type by its format's own name, the same in every language. */
const FORMATS: { readonly [T in AssetMediaType]: string } = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/svg+xml': 'SVG' }

/** What to do about each refusal of 0030, in the editor's words: a file that is no SVG at all is said as any file that is no image. */
const SVG_REASONS = {
  'not-svg': 'images.reason.notImage',
  'not-well-formed': 'images.reason.svgBroken',
  encoding: 'images.reason.svgEncoding',
  doctype: 'images.reason.svgDoctype',
  text: 'images.reason.svgText',
  raster: 'images.reason.svgRaster',
  reference: 'images.reason.svgReference',
  unsupported: 'images.reason.svgUnsupported',
  'out-of-range': 'images.reason.svgRange',
  'too-large': 'images.reason.svgLarge',
  'too-deep': 'images.reason.svgDeep',
} as const satisfies { readonly [C in SvgRefusalCode]: MessageId }

/**
 * What cleaning removed that has no name to repeat, in the editor's words:
 * a comment, a declaration, a document type, and a name report-spec would
 * not repeat (`shown`), which it says as a phrase -- and no name of XML
 * holds a space.
 */
const UNNAMED: { readonly [K in SvgRemovalKind]: MessageId } = {
  element: 'images.svgElement',
  attribute: 'images.svgAttribute',
  property: 'images.svgProperty',
  comment: 'images.svgComment',
  declaration: 'images.svgDeclaration',
  doctype: 'images.svgDoctype',
}

/** Bytes in a megabyte as the format's limit counts them: 20 × 1,048,576. */
const MEGABYTE = 1_048_576

/** The host's store as the editor holds it, checked when the editor is made: the types it keeps in the format's order, and the chooser's `accept`. */
interface HeldStore {
  readonly store: ImageStore
  readonly types: readonly AssetMediaType[]
  readonly accept: string
}

/** What an editor knows of images that no edit changes: the host's store, held, and its words, numbers and lists in one language. */
export interface Images {
  readonly held: HeldStore | null
  readonly t: EditorText
  readonly number: Intl.NumberFormat
  readonly megabytes: Intl.NumberFormat
  readonly list: Intl.ListFormat
}

/**
 * The store a host gave, held: a store with no way to keep, or one that
 * keeps no type the format draws, is the host's mistake, refused as a
 * RangeError when the editor is made rather than met by a person later.
 */
export function imagesOf(store: ImageStore | undefined, locale: EditorLocale, t: EditorText): Images {
  const words = {
    t,
    number: new Intl.NumberFormat(locale),
    // Rounded up, so that a file past the limit never reads as the limit itself.
    megabytes: new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1, roundingMode: 'ceil' }),
    list: new Intl.ListFormat(locale, { type: 'conjunction' }),
  }
  if (store === undefined) return { ...words, held: null }
  if (typeof store?.keep !== 'function') throw new RangeError('An image store needs a keep function: the editor hands it every image a person adds.')
  const accept: readonly string[] = store.accept ?? ASSET_MEDIA_TYPES
  const unknown = Array.isArray(accept) ? accept.filter((type) => !(ASSET_MEDIA_TYPES as readonly string[]).includes(type)) : [String(accept)]
  if (unknown.length > 0 || accept.length === 0) throw new RangeError(`An image store keeps one or more of ${ASSET_MEDIA_TYPES.join(', ')}${unknown.length === 0 ? '' : `, not ${unknown.join(', ')}`}.`)
  const types = ASSET_MEDIA_TYPES.filter((type) => accept.includes(type))
  return { ...words, held: { store, types, accept: types.flatMap((type) => [type, ...EXTENSIONS[type]]).join(',') } }
}

/** Why Add image… takes no file now, or undefined when it does: no store, an image being added, or a report that holds all it may. */
export function addRefusal(images: Images, adding: string | null, report: ReportDefinition): { readonly code: Extract<EditorRefusalCode, 'unavailable' | 'busy'>; readonly message: string } | undefined {
  const { t } = images
  if (images.held === null) return { code: 'unavailable', message: t('images.none') }
  if (adding !== null) return { code: 'busy', message: t('images.busy', { name: adding }) }
  if (report.assets.length >= MAX_ASSETS) return { code: 'unavailable', message: t('images.full', { count: images.number.format(MAX_ASSETS) }) }
  return undefined
}

/** The labels of what draws each of the report's images, by asset, in the outline's order. */
function drawers(derived: Derived): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, string[]>()
  for (const { component } of walkComponents(derived.report)) {
    if (component.kind !== 'image' || component.source.kind !== 'asset') continue
    const by = found.get(component.source.asset) ?? []
    by.push(derived.labels.get(component.id) ?? component.id)
    found.set(component.source.asset, by)
  }
  return found
}

/** The library the state shows: the report's images, each with what draws it, and whether Add image… takes a file. */
export function imageLibrary(images: Images, derived: Derived, adding: string | null): ImageLibrary {
  const { t, held, list } = images
  const drawn = drawers(derived)
  const assets = derived.report.assets.map(({ id, mediaType }): LibraryAsset => {
    const by = drawn.get(id)
    return { id, label: t('images.item', { id, type: FORMATS[mediaType] }), removeLabel: t('images.removeOne', { id }), ...(by === undefined ? {} : { inUse: t('images.inUse', { names: list.format(by) }) }) }
  })
  const why = held === null ? undefined : addRefusal(images, adding, derived.report)
  return { store: held !== null, accept: held?.accept ?? '', adding, ...(why === undefined ? {} : { unavailable: why.message }), assets }
}

/** What the editor lends its image actions: its document and its own state, and its one way each of acting, committing and refusing. */
export interface ImageEditing {
  current(): Derived
  local(): Local
  setLocal(next: Partial<Local>): void
  announce(text: string): Partial<Local>
  refuse(code: EditorRefusalCode, text: string, refusal?: Refusal): EditorOutcome
  commit(command: Command<object>, label: string): CommandOutcome
  /** Runs `run` as one action, listeners told once when it is done; what was thrown on the way, by it or by a listener, is added to `errors`. */
  act<T>(run: () => T, errors: unknown[]): T | undefined
  raise(errors: readonly unknown[]): void
  disposed(): boolean
}

/** An image read and checked, whether it is a CMYK JPEG, with what cleaning removed from it, said; or why it was refused. */
type Recognised =
  | { readonly ok: true; readonly mediaType: AssetMediaType; readonly bytes: Uint8Array; readonly width: number; readonly height: number; readonly cmyk: boolean; readonly cleaned?: string }
  | { readonly ok: false; readonly reason: string }

/** The editor's image actions over `editing`. */
export function imageActions(images: Images, editing: ImageEditing) {
  const { t, held, number } = images
  const disposed = (): EditorOutcome => ({ ok: false, code: 'disposed', message: t('status.disposed') })
  /**
   * Every id the host kept bytes under, and which bytes, by type and
   * digest: never handed it again for others, since an undo may declare
   * the asset again that a Remove took, and a host that keys by id alone
   * would then answer with the later bytes. For the same bytes it is the
   * image's own id again.
   */
  const kept = new Map<string, string>()
  const bytesOf = (image: { readonly mediaType: AssetMediaType; readonly digest: string }): string => `${image.mediaType} ${image.digest}`
  /** The ids the host kept other bytes under than these. */
  const keptOtherwise = (bytes: string): ReadonlySet<string> => new Set([...kept].filter(([, under]) => under !== bytes).map(([id]) => id))

  /** Ends an add: nothing is being added any more, and the live region says how it ended. */
  function end(outcome: EditorOutcome, text: string): EditorOutcome {
    editing.setLocal({ adding: null, ...editing.announce(text) })
    return outcome
  }

  function refused(code: EditorRefusalCode, name: string, reason: string, refusal?: Refusal): EditorOutcome {
    const message = t('images.refused', { name, reason })
    return end({ ok: false, code, message, ...(refusal === undefined ? {} : { refusal }) }, message)
  }

  const tooLarge = (size: number): string => t('images.reason.tooLarge', { size: images.megabytes.format(size / MEGABYTE), limit: images.megabytes.format(MAX_ASSET_BYTES / MEGABYTE) })

  /** What cleaning removed, said: each name, the first cleanSvg lists, and how many more. */
  function cleanedOf(removed: readonly SvgRemoval[], more: number): string | undefined {
    if (removed.length === 0) return undefined
    const names = removed.map(({ kind, name }) => (kind === 'element' || kind === 'attribute' || kind === 'property') && !name.includes(' ') ? name : t(UNNAMED[kind]))
    if (more > 0) names.push(t('images.cleanedMore', { count: number.format(more) }))
    return t('images.cleaned', { names: images.list.format(names) })
  }

  /** What `bytes` are as the report takes them, from the bytes alone, or why not. */
  function recognise(bytes: Uint8Array, types: readonly AssetMediaType[]): Recognised {
    const type = sniffImage(bytes)
    if (type === undefined) return { ok: false, reason: t('images.reason.notImage') }
    if (!types.includes(type)) return { ok: false, reason: t('images.reason.notAccepted') }
    if (type === 'image/svg+xml') {
      const drawing = cleanSvg(bytes)
      if (!drawing.ok) return { ok: false, reason: t(SVG_REASONS[drawing.code]) }
      const cleaned = cleanedOf(drawing.removed, drawing.removedMore)
      return { ok: true, mediaType: type, bytes: drawing.bytes, width: drawing.viewBox.width, height: drawing.viewBox.height, cmyk: false, ...(cleaned === undefined ? {} : { cleaned }) }
    }
    const header = imageHeader(bytes)
    if (header.ok) return { ok: true, mediaType: header.mediaType, bytes, width: header.width, height: header.height, cmyk: header.mediaType === 'image/jpeg' && header.components === 4 }
    switch (header.code) {
      case 'too-large':
        return { ok: false, reason: t('images.reason.tooWide', { width: number.format(header.width), height: number.format(header.height), side: number.format(MAX_ASSET_SIDE) }) }
      case 'no-pixels':
        return { ok: false, reason: t('images.reason.noPixels', { width: number.format(header.width), height: number.format(header.height) }) }
      case 'malformed':
      case 'not-raster':
        return { ok: false, reason: t('images.reason.malformed', { type: FORMATS[type] }) }
    }
  }

  /** The asset the report declares with these bytes already, which an add hands the host again and does not declare again. */
  const declared = (image: { readonly mediaType: AssetMediaType; readonly digest: string }): string | undefined =>
    editing.current().report.assets.find((asset) => asset.digest === image.digest && asset.mediaType === image.mediaType)?.id

  /** The first phase: refused before anything is read, or the file taken, and said: the store it goes to. */
  function take(file: ImageFile, name: string): HeldStore | EditorOutcome {
    const why = addRefusal(images, editing.local().adding, editing.current().report)
    if (why !== undefined) return editing.refuse(why.code, why.message)
    // A builder in plain JavaScript may hand on no file at all.
    if (typeof file?.arrayBuffer !== 'function') return editing.refuse('not-an-image', t('images.refused', { name, reason: t('images.reason.unreadable') }))
    // A 2 GB file is never read into the page's memory to be refused.
    if (typeof file.size === 'number' && file.size > MAX_ASSET_BYTES) return editing.refuse('not-an-image', t('images.refused', { name, reason: tooLarge(file.size) }))
    editing.setLocal({ adding: name, ...editing.announce(t('images.adding', { name })) })
    // addRefusal refuses an editor without a store.
    return held as HeldStore
  }

  /**
   * The second: what the bytes read are, the image to hand the host, or how
   * the add ended. Bytes the report declares already go to the host again,
   * under the id they are declared by: a report opened where another host
   * kept them prints them as missing until a person supplies them.
   */
  function check(name: string, bytes: Uint8Array, store: HeldStore): { readonly image: AddedImage; readonly cleaned?: string } | EditorOutcome {
    if (editing.disposed()) return disposed()
    if (bytes.length > MAX_ASSET_BYTES) return refused('not-an-image', name, tooLarge(bytes.length))
    const found = recognise(bytes, store.types)
    if (!found.ok) return refused('not-an-image', name, found.reason)
    const { mediaType, width, height, cleaned } = found
    const { report } = editing.current()
    // An e-invoice is drawn as a PDF/A-3b whose output intent is sRGB, beside which no image may be CMYK (0031).
    if (found.cmyk && report.eInvoice !== undefined) return refused('not-an-image', name, t('images.reason.cmykEInvoice'))
    const digest = assetDigest(found.bytes)
    const asset = declared({ mediaType, digest }) ?? nextAssetId(report, assetBase(name), keptOtherwise(bytesOf({ mediaType, digest })))
    return { image: { asset, mediaType, digest, bytes: found.bytes, fileName: name, width, height }, ...(cleaned === undefined ? {} : { cleaned }) }
  }

  /** The last: the asset declared, once the host kept its bytes, or why not. */
  function declare(name: string, image: AddedImage, cleaned: string | undefined, answer: KeptImage | undefined): EditorOutcome {
    if (editing.disposed()) return disposed()
    if (answer?.ok !== true) return refused('not-kept', name, answer?.ok === false && typeof answer.message === 'string' ? answer.message : t('images.reason.notKept'))
    kept.set(image.asset, bytesOf(image))
    // Declared already, or meanwhile by another editor of the session: the report holds it.
    const already = declared(image)
    if (already !== undefined) return end(DONE, t('images.already', { id: already }))
    const outcome = editing.commit((report) => addAsset(report, image.asset, { mediaType: image.mediaType, digest: image.digest }), stepLabel({ do: 'addImage' }))
    if (outcome.ok) {
      const said = t('images.added', { id: image.asset, kind: t('kind.image') })
      return end(DONE, cleaned === undefined ? said : `${said} ${cleaned}`)
    }
    // An add never replaces: another image declared under this id meanwhile stays as it is.
    if (outcome.code === 'already-declared') return refused('changed', name, t('images.reason.changed', { id: image.asset }), outcome)
    return refused('refused', name, refusalMessage(outcome, '/assets'), outcome)
  }

  async function phases(file: ImageFile, name: string, store: HeldStore, errors: unknown[]): Promise<EditorOutcome | undefined> {
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      return editing.act(() => refused('not-an-image', name, t('images.reason.unreadable')), errors)
    }
    const checked = editing.act(() => check(name, bytes, store), errors)
    if (checked === undefined || 'ok' in checked) return checked
    let answer: KeptImage | undefined
    try {
      answer = await store.store.keep(checked.image)
    } catch {
      answer = undefined
    }
    return editing.act(() => declare(name, checked.image, checked.cleaned, answer), errors)
  }

  return {
    chooseImage(): EditorOutcome {
      const why = addRefusal(images, editing.local().adding, editing.current().report)
      return why === undefined ? DONE : editing.refuse(why.code, why.message)
    },

    removeImage(id: string): EditorOutcome {
      const derived = editing.current()
      if (!derived.report.assets.some((asset) => asset.id === id)) return editing.refuse('not-found', t('status.notFound', { name: String(id) }))
      // The validator would refuse it too (`unknown-asset`), in words about a path, where the person needs what draws it.
      const by = drawers(derived).get(id)
      if (by !== undefined) return editing.refuse('unavailable', t('images.inUse', { names: images.list.format(by) }))
      const outcome = editing.commit((report) => removeAsset(report, id), stepLabel({ do: 'removeImage' }))
      if (!outcome.ok) return editing.refuse('refused', t('status.refused', { name: id, reason: refusalMessage(outcome, '/assets') }), outcome)
      editing.setLocal(editing.announce(t('images.removed', { id })))
      return DONE
    },

    /** `ReportEditor.addImage`. */
    async addImage(file: ImageFile): Promise<EditorOutcome> {
      if (editing.disposed()) return disposed()
      const errors: unknown[] = []
      const name = String(file?.name ?? '')
      const store = editing.act(() => take(file, name), errors)
      // Refused at once, or a throw before anything was taken.
      if (store === undefined || 'ok' in store) {
        editing.raise(errors)
        return store as EditorOutcome
      }
      let outcome: EditorOutcome | undefined
      try {
        outcome = await phases(file, name, store, errors)
      } finally {
        // An add that ended by a throw lets go of its file all the same.
        if (editing.local().adding !== null) editing.act(() => editing.setLocal({ adding: null }), errors)
      }
      editing.raise(errors)
      return outcome as EditorOutcome
    },
  }
}
