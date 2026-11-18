import { faceKey, readFont, RenderRefusal, type FontAsset, type FontFaceKey, type FontFamily, type ResolvedFonts } from '@formancy/report-runtime'
import { MAX_DOCX_FAMILY_LENGTH } from './limits.js'
import { ROBOTO } from './look.js'
import { attribute, xmlCharacter } from './xml.js'

/**
 * How a document's font tokens become the families a Word file names
 * (0068). The file names families and embeds none: a reader that has the
 * family draws in it, and one that has not chooses another by the kind
 * the font table states -- swiss, roman or modern -- with nothing saying
 * so.
 *
 * A token the report maps (0043) is named by the family its normal face
 * states, read by report-spec's `readFont` as the PDF renderer reads it:
 * name ID 1, the family Word lists a face under, where the font states a
 * typographic family beside it (`legacyFamily`), since to Word "Probe
 * Sans Light" is a family of its own and "Probe Sans" another. The faces
 * of one token must be of one typographic family, since the file names
 * one family for it and sets weight and slant as `w:b` and `w:i`, which
 * Word draws by its own rule -- the cost record 0068 names. `sans`
 * unmapped is Roboto, the face the PDF prints it in; `serif` and `mono`
 * unmapped are refused, as the PDF renderer refuses them, and so is a
 * weight or a slant a mapped token has no face for: Word would
 * synthesise one, the substitution 0043 rules out.
 *
 * A family's name is a font's own string, and every run and every
 * paragraph mark states it in four font slots. report-spec's reader
 * holds a PostScript name to 63 characters and a family to none, so a
 * name longer than Word reads, `MAX_DOCX_FAMILY_LENGTH`, is refused as
 * a family no reader would find; and what a name within it is written
 * longer than that, escaped -- a quotation mark is six characters in an
 * attribute -- is counted with the file's characters, wherever a run or
 * a mark states it (`longer`).
 *
 * A mapped face's characters are known, so text is held to them as the
 * PDF holds it; Roboto's bytes are not in this package, and what it has
 * no glyph for is written, and drawn by Word in a face of its choosing.
 */

/** What text asks for: the token it is set in, or none, and whether it prints bold and italic. */
export interface FaceWanted {
  readonly token: FontFamily | undefined
  readonly bold: boolean
  readonly italic: boolean
}

/** A family as the font table lists it: its name, and the kind a reader without it chooses another by. */
export interface FontEntry {
  readonly name: string
  readonly kind: 'swiss' | 'roman' | 'modern'
}

export interface DocxFonts {
  /** Whether a style may name `token`: `sans` always, `serif` and `mono` only where the report maps them. */
  usable(token: FontFamily): boolean
  /** The family text of `token` is named in; text with no token prints in the sans token's. */
  family(token: FontFamily | undefined): string
  /**
   * The characters a run, or a paragraph's mark, of `token` is written
   * longer than the bounds are measured with (`limits.ts`): its four font
   * slots, each by what the family, escaped, is past
   * `MAX_DOCX_FAMILY_LENGTH`. None for a family written as it is named.
   */
  longer(token: FontFamily | undefined): number
  /** The characters the face `wanted` asks for draws, or undefined for Roboto, whose bytes the writer has not; refused, naming `subject`, where the token maps no such face. */
  glyphs(wanted: FaceWanted, subject: string): { readonly characters: ReadonlySet<number> | undefined; readonly name: string }
  /** Every family the file may name, the sans token's first. */
  readonly table: readonly FontEntry[]
}

const KINDS: Readonly<Record<FontFamily, FontEntry['kind']>> = { sans: 'swiss', serif: 'roman', mono: 'modern' }
const FACE_WORDS: Readonly<Record<FontFaceKey, string>> = { normal: 'regular', bold: 'bold', italic: 'italic', boldItalic: 'bold italic' }
const WEIGHT: Readonly<Record<FontFaceKey, string>> = { normal: 'text', bold: 'bold text', italic: 'italic text', boldItalic: 'bold italic text' }

interface ReadFace {
  readonly characters: ReadonlySet<number>
  /** The typographic family, which the faces of a token share. */
  readonly family: string
  /** The family Word lists the face under. */
  readonly listed: string
}

/** The font slots a run's and a paragraph mark's `w:rFonts` names its family in (`wml.ts`). */
const FONT_SLOTS = 4

/** A family name as a Word file can name it: something, of characters XML holds, none of them a control. */
function writable(family: string): boolean {
  return family.trim() !== '' && [...family].every((character) => xmlCharacter(character.codePointAt(0)!) && !/\p{Cc}/u.test(character))
}

/** The plan for `fonts`, the document's resolved font map: each face read once, however many tokens and faces name it. */
export function planFonts(fonts: ResolvedFonts | undefined): DocxFonts {
  const read = new Map<FontAsset, ReadFace>()
  const readAsset = (asset: FontAsset): ReadFace => {
    const known = read.get(asset)
    if (known !== undefined) return known
    const font = readFont(asset.bytes)
    if (!font.ok) throw new RenderRefusal('invalid-asset', `the font asset ${asset.id} ${font.message}`, asset.id)
    const listed = font.names.legacyFamily ?? font.names.family
    // Its length alone, never the name: a name is the font's own string, and one past the bound may be as long as the font is.
    if (listed.length > MAX_DOCX_FAMILY_LENGTH)
      throw new RenderRefusal(
        'invalid-asset',
        `the font asset ${asset.id} names its family in ${listed.length} characters; Word reads a family's name of at most ${MAX_DOCX_FAMILY_LENGTH}, so a Word file could name it by none a reader would find`,
        asset.id,
      )
    if (!writable(listed))
      throw new RenderRefusal(
        'invalid-asset',
        `the font asset ${asset.id} names its family with nothing, or with a character a Word file cannot name a family by`,
        asset.id,
      )
    const face = { characters: font.characters, family: font.names.family, listed }
    read.set(asset, face)
    return face
  }
  const mapped: {
    -readonly [F in FontFamily]?: {
      readonly listed: string
      readonly longer: number
      readonly faces: Partial<Record<FontFaceKey, ReadFace & { readonly name: string }>>
    }
  } = {}
  for (const token of ['sans', 'serif', 'mono'] as const) {
    const resolved = fonts?.[token]
    if (resolved === undefined) continue
    const faces: Partial<Record<FontFaceKey, ReadFace & { readonly name: string }>> = {}
    for (const key of ['normal', 'bold', 'italic', 'boldItalic'] as const) {
      const asset = resolved[key]
      if (asset !== undefined) faces[key] = { ...readAsset(asset), name: `the ${token} font's ${FACE_WORDS[key]} face, the asset ${asset.id},` }
    }
    const normal = faces.normal
    if (normal === undefined)
      throw new RenderRefusal('unsupported', `the ${token} font maps no regular face, which names the family a Word file sets its text in`, `fonts.${token}`)
    for (const key of ['bold', 'italic', 'boldItalic'] as const) {
      const [face, asset] = [faces[key], resolved[key]]
      if (face !== undefined && asset !== undefined && face.family !== normal.family) {
        throw new RenderRefusal(
          'unsupported',
          `${face.name} is of another family than its regular face; a Word file names one family for a font and sets weight and slant on it, so the faces of one font must be of one family`,
          asset.id,
        )
      }
    }
    mapped[token] = { listed: normal.listed, longer: FONT_SLOTS * Math.max(0, attribute(normal.listed).length - MAX_DOCX_FAMILY_LENGTH), faces }
  }
  const family = (token: FontFamily | undefined): string => mapped[token ?? 'sans']?.listed ?? ROBOTO
  const table: FontEntry[] = []
  for (const token of ['sans', 'serif', 'mono'] as const) {
    if (token !== 'sans' && mapped[token] === undefined) continue
    if (!table.some((entry) => entry.name === family(token))) table.push({ name: family(token), kind: KINDS[token] })
  }
  return {
    usable: (token) => token === 'sans' || mapped[token] !== undefined,
    family,
    // Roboto is written as it is named.
    longer: (token) => mapped[token ?? 'sans']?.longer ?? 0,
    glyphs: (wanted, subject) => {
      const token = wanted.token ?? 'sans'
      const faces = mapped[token]?.faces
      if (faces === undefined) {
        if (token === 'sans') return { characters: undefined, name: ROBOTO }
        throw new RenderRefusal(
          'unsupported',
          `${subject} is set in the ${token} font, which the report maps to no host font; a Word file names Roboto alone, as the sans font, and no other in its place`,
          subject,
        )
      }
      const key = faceKey(wanted.bold, wanted.italic)
      const face = faces[key]
      if (face === undefined)
        throw new RenderRefusal(
          'unsupported',
          `${subject} prints ${WEIGHT[key]} in the ${token} font, which maps no ${key} face; Word would synthesise one, and the PDF prints none`,
          subject,
        )
      return face
    },
    table,
  }
}
