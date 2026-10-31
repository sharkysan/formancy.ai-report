/**
 * How PDFKit tells one face of a render from another, and the host faces
 * the renderer refuses because it would not (0043).
 *
 * PDFKit 0.19.1 keeps a document's fonts in a plain object keyed by the
 * PostScript name fontkit reads (`font()`, pdfkit.js 2826-2869), and
 * pdfmake opens every face it reads from bytes through it with no key of
 * its own (`PDFDocument.provideFont`): each host face, and in a browser
 * Roboto and Liberation Sans as well. Three things follow.
 *
 * - **Two faces of one name are drawn as one.** A face whose PostScript
 *   name, `head.checkSumAdjustment` and naming table are those of a face
 *   already open is drawn as that face (`isEqualFont`, pdfkit.js 2803),
 *   whichever pdfmake opened first: its glyphs, its line and its widths,
 *   while check.ts and bound.ts measured each by its own. Nothing checks
 *   the checksum, so a copy of a face's naming table and header field is
 *   enough: a mono that was Roboto Regular with only its line changed
 *   printed the Roboto text beside it at its own line, and a 96 pt line was
 *   gone; a sans that was Liberation Sans with a 4 em line laid a QR-bill's
 *   slip out in its own line, and 7 of the slip's runs were gone (review of
 *   P07, 22 October 2026).
 * - **A face of bytes is looked up under `null` first**, and takes
 *   whatever face is kept there, comparing nothing: a face whose PostScript
 *   name is `null` was the face every face opened after it printed in.
 * - **A name `Object.prototype` holds is a font already.** Looked up under
 *   `constructor`, `toString` or `__proto__`, PDFKit finds a function, and
 *   throws a TypeError naming nothing.
 *
 * So a host face is refused as `invalid-asset`, in numbers and its id
 * alone, where one of its PostScript names is `null` or a name of
 * `Object.prototype`, or is the name of another face of the render with
 * other bytes: another host asset, or one of the renderer's own six faces,
 * whether or not the document prints in it. Every name its records of name
 * ID 6 hold is read, report-spec's `postScriptNames`, since which of them
 * fontkit returns depends on their order and languages. That refuses more
 * than PDFKit merges -- a face of another checksum or naming table would
 * print as itself -- and fails closed. Faces of the same bytes are allowed:
 * two host assets of one font are stripped alike and drawn as one, which
 * they are, and a host face of the renderer's own bytes is embedded as the
 * renderer embeds that face, its layout tables kept, so that what PDFKit
 * draws is the same whichever copy it opened first. Its bytes are known by
 * their digest, taken here from the bytes, never from the asset's word.
 */
import { assetDigest, RenderRefusal, type FontAsset } from '@formancy/report-runtime'

/** One of the renderer's own faces: what a refusal calls it, the PostScript name fontkit reads in it, and its bytes' digest. `fonts.test.ts` holds each to the file pdfmake or this package ships. */
export interface OwnFace {
  readonly name: string
  readonly postScriptName: string
  readonly digest: string
}

/** Roboto 3.014's four faces, from pdfmake 0.3.11's package and its `vfs_fonts.js`, and Liberation Sans 2.1.5's two, from this package's `fonts`. */
export const OWN_FACES: readonly OwnFace[] = [
  { name: 'Roboto Regular', postScriptName: 'Roboto-Regular', digest: 'sha256:ab9c18a75da1636435afd2398ffce325496644a8f258f918c92c4baf34a68625' },
  { name: 'Roboto Medium', postScriptName: 'Roboto-Medium', digest: 'sha256:4cb9d8a346d7d9190ef145daad9a85d58e2592043b199cdb8ed52ff535c64047' },
  { name: 'Roboto Italic', postScriptName: 'Roboto-Italic', digest: 'sha256:b9e7d02d28dd215bd1dbb164d2d75bc1bbccf754a17390efc8678feb78017577' },
  { name: 'Roboto Medium Italic', postScriptName: 'Roboto-MediumItalic', digest: 'sha256:1b4daee5311f0bcd8e1b79d44d1d5ba675a72abb6624d2b0ed77fda1c65d77b1' },
  { name: 'Liberation Sans Regular', postScriptName: 'LiberationSans', digest: 'sha256:76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8' },
  { name: 'Liberation Sans Bold', postScriptName: 'LiberationSans-Bold', digest: 'sha256:788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173' },
]

/** A host face as the plan read it: its asset, and every PostScript name it states. */
export interface HostFace {
  readonly asset: FontAsset
  readonly postScriptNames: readonly string[]
}

/** The key PDFKit looks a face opened from bytes up by before its name: `null`, as a property name. */
const UNKEYED = 'null'

/**
 * What PDFKit draws `face` as, beside `others`, the host faces this render
 * read before it: the renderer's own face whose bytes it has, which the
 * engine embeds as the renderer embeds that face, or undefined for a face
 * PDFKit draws as itself. A face PDFKit could draw as another, or fail on,
 * is refused.
 */
export function drawnAs(face: HostFace, others: readonly HostFace[]): OwnFace | undefined {
  const { id } = face.asset
  if (face.postScriptNames.some((name) => name === UNKEYED || name in Object.prototype)) {
    throw new RenderRefusal(
      'invalid-asset',
      `the font asset ${id} has a PostScript name PDFKit keeps fonts under before it reads one, and would draw it as another face or fail on it`,
      id,
    )
  }
  let digest: string | undefined
  const digestOf = (): string => (digest ??= assetDigest(face.asset.bytes))
  const shares = (names: readonly string[]): boolean => names.some((name) => face.postScriptNames.includes(name))
  for (const other of others) {
    if (other.asset.id !== id && shares(other.postScriptNames) && assetDigest(other.asset.bytes) !== digestOf()) {
      throw new RenderRefusal(
        'invalid-asset',
        `the font asset ${id} has a PostScript name of the font asset ${other.asset.id}, with other bytes: PDFKit draws two faces of one PostScript name as whichever it opened first`,
        id,
      )
    }
  }
  const own = OWN_FACES.find((each) => shares([each.postScriptName]))
  if (own === undefined) return undefined
  if (digestOf() !== own.digest) {
    throw new RenderRefusal(
      'invalid-asset',
      `the font asset ${id} has the PostScript name of the renderer's own ${own.name}, with other bytes: PDFKit draws two faces of one PostScript name as whichever it opened first, and accepts only the renderer's own bytes under that name`,
      id,
    )
  }
  return own
}
