/**
 * How a document's font tokens become the faces the renderer embeds and
 * measures text in (0043).
 *
 * A report maps each of `sans`, `serif` and `mono` to the faces a host
 * approved, resolved by the runtime to their bytes (`ResolvedFonts`). Here
 * each face is read once more with report-spec's `readFont` -- the renderer
 * is a package boundary that refuses what it cannot draw (0011) -- refused
 * where PDFKit would draw it as another face (`face-identity.ts`), its
 * layout tables stripped so fontkit cannot hang a render
 * (`strip-layout.ts`) unless it is one of the renderer's own faces, and
 * the bytes go into pdfmake's virtual files under a name of this render's
 * own. The plan then answers, for any
 * token and weight and slant: the characters that face draws, the line
 * pdfmake lays it out by (its hhea, ascender less descender, over its
 * units, which report-spec's reader holds to `MIN_FONT_LINE` to
 * `MAX_FONT_LINE` ems) and its baseline in that line, the key a measurer
 * keeps its widths by -- the digest of the bytes it embeds, taken only for
 * a face a chart prints in -- and the pdfmake family a style names it by.
 *
 * A token a report does not map prints in the renderer's own face: `sans`
 * is Roboto, and `serif` and `mono` are refused, exactly as before a report
 * could name a host's font. Text with no token prints in the mapped `sans`
 * where there is one, else Roboto. A face a style asks for and the family
 * does not map is refused, never synthesised: pdfmake's faux bold and
 * oblique are a substitution nobody sees until the PDF is read (plan 20).
 *
 * Nothing outlives the render. Each plan reads the bytes it is handed, so
 * what a face prints is always the bytes this document carries, never a
 * face another render read under the same digest; and its virtual files
 * are named by the render, `formancy-report-render-pdf/font/<render>/<n>.ttf`,
 * so two renders at once never share one, and one that ends never takes
 * another's file from under it (`engine.ts` writes them for each pass and
 * deletes them after). Reading a face again costs a millisecond for a
 * typical font (0043).
 */
import {
  assetDigest,
  faceKey,
  type FontAsset,
  type FontFaceKey,
  type FontFamily,
  readFont,
  RenderRefusal,
  type ResolvedFaces,
  type ResolvedFonts,
} from '@formancy/report-runtime'
import { drawnAs, type HostFace } from './face-identity.js'
import { type Face, faceOf, type Glyphs } from './glyphs.js'
import { withoutLayoutTables } from './strip-layout.js'
import { LINE_FACTOR, ROBOTO, ROBOTO_ASCENT, ROBOTO_DESCENT } from './style.js'

/** What the renderer needs of one face to check, lay out and measure text: the characters it draws, the line pdfmake lays it out by, as a multiple of the font size, where its baseline stands, what a measurer knows it by, and what a refusal calls it. */
export interface RenderFace {
  readonly glyphs: ReadonlySet<number>
  readonly lineFactor: number
  /** Its ascender and its descender over its units per em, from the horizontal header its line is read from: the descender is negative, below the baseline, and the line their difference: what a chart's word, placed in its line, is boxed by from its baseline. */
  readonly ascent: number
  readonly descent: number
  /**
   * What a measurer that keeps widths by face knows it by -- zrender's,
   * process-wide, which ECharts measures a chart's words through: the
   * digest of the bytes this render embeds for it, stripped as they are
   * embedded, never the digest it was handed under, which nothing holds to
   * its bytes; or `Roboto/<face>` for the renderer's own, whose bytes a
   * release fixes. Two faces of one key draw every word alike.
   *
   * Taken the first time it is asked for, and kept for the render: a
   * SHA-256 of Liberation Serif's 384 KiB took 3.3 ms, and six of them a
   * quarter of the corpus's `host-fonts` render, which draws no chart
   * (measured on 12 November 2026, Node 22.23.3 on an Apple M2).
   */
  readonly key: () => string
  /** "Roboto", or "the serif font's bold face, the asset brand-bold,": the face a refusal says a character is missing from. */
  readonly name: string
}

/** What text asks the plan for: the token it is set in, or none, and whether it prints bold and italic. */
export interface FaceWanted {
  readonly token: FontFamily | undefined
  readonly bold: boolean
  readonly italic: boolean
}

/** The pdfmake font families and virtual files a document's host faces add, which the engine registers for each pass and removes after it. */
export interface HostFontFiles {
  /** Each pdfmake family name to its faces' virtual-file names; merged over the renderer's own Roboto and Liberation Sans. */
  readonly families: Readonly<Record<string, Partial<Record<Face, string>>>>
  /** Each virtual-file name to the stripped bytes to embed. */
  readonly files: ReadonlyMap<string, Uint8Array>
}

/** The plan a render reads: resolve a style's face, name a token's family, the default family for text with no token, and the files the engine adds. */
export interface RenderFonts {
  face(token: FontFamily | undefined, bold: boolean, italic: boolean, subject: string): RenderFace
  /** Whether a style may name `token`: `sans` always (Roboto), `serif` and `mono` only where the report maps them. */
  usable(token: FontFamily): boolean
  readonly familyOf: (token: FontFamily) => string
  readonly defaultFamily: string
  readonly engine: HostFontFiles
}

/** pdfmake's face name for report-spec's face key: pdfmake calls the slanted faces `italics` and `bolditalics`. */
const PDFMAKE_FACE: Readonly<Record<FontFaceKey, Face>> = { normal: 'normal', bold: 'bold', italic: 'italics', boldItalic: 'bolditalics' }

/** A face key in a person's words. */
const FACE_WORDS: { readonly [K in FontFaceKey]: string } = { normal: 'regular', bold: 'bold', italic: 'italic', boldItalic: 'bold italic' }

/** The pdfmake family name a mapped token prints in: its own, so a host's family of the same name as the renderer's cannot replace it. */
const hostFamily = (token: FontFamily): string => `formancy-host-${token}`

/** Renders planned in this process or page, so that each names its virtual files apart from every other's. */
let renders = 0

/** A face read for this render: its glyphs, its line and baseline, its key, what a refusal calls it, and the virtual file the engine embeds it from. */
interface PlannedFace extends RenderFace {
  readonly file: string
}

/** A face asset as this render read it, before a token and a face name it. */
type ReadFace = Omit<PlannedFace, 'name'>

/**
 * The plan for `fonts` -- the document's resolved font map -- over the
 * renderer's own Roboto, whose glyphs `roboto` holds. `undefined` fonts, or
 * a token left out, prints in Roboto (`sans`) or is refused (`serif`,
 * `mono`), as before. Each face asset is read once however many tokens and
 * faces name it, and refused as `invalid-asset`, naming it, where `readFont`
 * refuses its bytes, PDFKit would draw it as another face
 * (`face-identity.ts`), or its id is handed again in other bytes.
 */
export function planFonts(fonts: ResolvedFonts | undefined, roboto: Glyphs): RenderFonts {
  const render = (renders += 1)
  const read = new Map<string, ReadFace & { readonly bytes: Uint8Array }>()
  const hosts: HostFace[] = []
  const files = new Map<string, Uint8Array>()
  /**
   * `asset` read and stripped, the first time this render meets it: a face
   * of the renderer's own bytes is embedded as the renderer embeds it,
   * layout tables and all. Met again by its id in other bytes -- a
   * document built by hand; the runtime resolves each id once -- it is
   * refused, since a face read by that id would print in the first bytes.
   */
  const readAsset = (asset: FontAsset): ReadFace => {
    const known = read.get(asset.id)
    if (known !== undefined) {
      if (known.bytes !== asset.bytes && assetDigest(known.bytes) !== assetDigest(asset.bytes)) {
        throw new RenderRefusal(
          'invalid-asset',
          `the font asset ${asset.id} is handed to the renderer twice, in other bytes the second time: an asset is one font, read by its id`,
          asset.id,
        )
      }
      return known
    }
    const font = readFont(asset.bytes)
    if (!font.ok) throw new RenderRefusal('invalid-asset', `the font asset ${asset.id} ${font.message}`, asset.id)
    const host = { asset, postScriptNames: font.names.postScriptNames }
    const own = drawnAs(host, hosts)
    hosts.push(host)
    const { ascender, descender, unitsPerEm } = font.metrics
    const file = `formancy-report-render-pdf/font/${render}/${read.size}.ttf`
    const embedded = own === undefined ? withoutLayoutTables(asset.bytes) : asset.bytes
    let digest: string | undefined
    const made = {
      bytes: asset.bytes,
      glyphs: font.characters,
      lineFactor: (ascender - descender) / unitsPerEm,
      ascent: ascender / unitsPerEm,
      descent: descender / unitsPerEm,
      key: (): string => (digest ??= assetDigest(embedded)),
      file,
    }
    read.set(asset.id, made)
    files.set(file, embedded)
    return made
  }

  const mapped: { -readonly [F in FontFamily]?: Partial<Record<FontFaceKey, PlannedFace>> } = {}
  const families: Record<string, Partial<Record<Face, string>>> = {}
  for (const token of ['sans', 'serif', 'mono'] as const) {
    const resolved: ResolvedFaces | undefined = fonts?.[token]
    if (resolved === undefined) continue
    const faces: { -readonly [K in FontFaceKey]?: PlannedFace } = {}
    const byName: Partial<Record<Face, string>> = {}
    for (const key of ['normal', 'bold', 'italic', 'boldItalic'] as const) {
      const asset = resolved[key]
      if (asset === undefined) continue
      const face = readAsset(asset)
      faces[key] = { ...face, name: `the ${token} font's ${FACE_WORDS[key]} face, the asset ${asset.id},` }
      byName[PDFMAKE_FACE[key]] = face.file
    }
    mapped[token] = faces
    families[hostFamily(token)] = byName
  }
  const defaultFamily = mapped.sans === undefined ? ROBOTO : hostFamily('sans')

  const face = (token: FontFamily | undefined, bold: boolean, italic: boolean, subject: string): RenderFace => {
    const effective: FontFamily = token ?? 'sans'
    const faces = mapped[effective]
    if (faces === undefined) {
      if (effective === 'sans') {
        const robotoFace = faceOf(bold, italic)
        return {
          glyphs: roboto[robotoFace],
          lineFactor: LINE_FACTOR,
          ascent: ROBOTO_ASCENT,
          descent: ROBOTO_DESCENT,
          key: () => `${ROBOTO}/${robotoFace}`,
          name: 'Roboto',
        }
      }
      throw new RenderRefusal(
        'unsupported',
        `${subject} is set in the ${token} font, which the report maps to no host font; the renderer embeds Roboto alone, as the sans font, and prints no other in its place`,
        subject,
      )
    }
    const key = faceKey(bold, italic)
    const planned = faces[key]
    if (planned === undefined)
      throw new RenderRefusal(
        'unsupported',
        `${subject} prints ${WEIGHT[key]} in the ${effective} font, which maps no ${key} face; the renderer never synthesises one`,
        subject,
      )
    return planned
  }

  const familyOf = (token: FontFamily): string => (mapped[token] === undefined ? ROBOTO : hostFamily(token))
  const usable = (token: FontFamily): boolean => token === 'sans' || mapped[token] !== undefined

  return { face, usable, familyOf, defaultFamily, engine: { families, files } }
}

/** What a face key prints, for a refusal a person reads. */
const WEIGHT: { readonly [K in FontFaceKey]: string } = { normal: 'text', bold: 'bold text', italic: 'italic text', boldItalic: 'bold italic text' }
