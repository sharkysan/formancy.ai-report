/**
 * What a host gives the editor to keep the images a person adds, what the
 * editor hands it, and the images as the state shows them (0033).
 *
 * A report holds an asset's id and digest alone, never its bytes (0007),
 * and a host's resolver answers for them when the report prints (0010). So
 * the bytes of an image a person adds go to the host, through the store it
 * gives `createReportEditor`, before the report declares the asset. One
 * store in the editor's options serves both builders and outlives a switch
 * between them; a builder only hands the editor the file a person chose.
 * Nothing here is the DOM's: a `File` is an `ImageFile` as it stands.
 */
import type { AssetMediaType } from '@formancy/report-spec'

/**
 * What a builder hands the editor for a file a person chose. A DOM `File`
 * is one, so a builder passes the file itself; this package, free of the
 * DOM, names only what it reads of it.
 */
export interface ImageFile {
  readonly name: string
  /** Bytes, as the file says: held to the format's limit before the file is read at all. */
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

/** An image a person added: read, recognised, checked and named by the editor, for the host to keep. */
export interface AddedImage {
  /**
   * The asset id the editor declares it under once it is kept: read from
   * the file's name, an identifier, unique among the report's assets and
   * the ids this editor had kept before; or, for bytes the report declares
   * already, the id it declares them by. It is the id the add means, not
   * one the report holds yet: an add that ends otherwise declares nothing,
   * and another editor of the session may declare it meanwhile for other
   * bytes, the add then refused as `changed`. So a store keys what it keeps
   * by `digest`, or by id and digest, never by id alone: the runtime does
   * not check bytes against their digest, and a lookup answering by id
   * alone would print another image unseen.
   */
  readonly asset: string
  readonly mediaType: AssetMediaType
  /** `sha256:` and 64 lower-case hex digits, of exactly `bytes` (report-spec's `assetDigest`). */
  readonly digest: string
  /** What the asset is: a PNG's or a JPEG's own bytes; an SVG's drawing as `cleanSvg` wrote it, never the file as chosen. The editor keeps no reference to them. */
  readonly bytes: Uint8Array
  /** The file's name as the person chose it, for the host's own records. Only the id read from it reaches the report. */
  readonly fileName: string
  /** Its size drawn at 1:1: a PNG's or a JPEG's pixels, as shown after a JPEG's Exif turn; an SVG's viewBox. */
  readonly width: number
  readonly height: number
}

/** Whether the host kept it. A refusal's message is shown to the person, after the editor's own words. */
export type KeptImage = { readonly ok: true } | { readonly ok: false; readonly message: string }

/**
 * Where the host keeps the images a person adds. The host decides where the
 * bytes live and whether they may; the report holds the asset's id and
 * digest, and the host's image resolver answers for them. A host that gives
 * the editor no store gets no Add image….
 */
export interface ImageStore {
  /** The media types this host keeps, at least one; every type the format draws when absent. */
  readonly accept?: readonly AssetMediaType[]
  /**
   * Keeps `image`. Resolve once the host's resolver answers for
   * `image.asset` and `image.digest`: the report declares the asset only
   * then, and a preview renders straight after. Resolve `{ ok: false }` to
   * refuse it, with a message for the person in the editor's language. A
   * rejection, or an answer that is neither, is a failure the person is
   * told of in the editor's own words: its error is never shown, so nothing
   * of the host's internals reaches the page. Called for one image at a
   * time, and never again for an undo or a redo, which need the bytes kept;
   * called again for bytes the report declares already when a person
   * chooses them again, under the id they are declared by, so that bytes a
   * host lacks can be supplied. It must settle: the editor waits for it,
   * says the image is being added and takes no other until it does, so a
   * keep that never settles leaves the editor busy for as long as it lives.
   */
  keep(image: AddedImage): Promise<KeptImage>
}

/** The images of the report, as a builder lists them in the report's own properties, and whether it offers Add image… at all. */
export interface ImageLibrary {
  /** Whether the host gave a store: whether a builder draws Add image…. */
  readonly store: boolean
  /** The file chooser's `accept`: each type the host keeps and its usual extensions, `image/png,.png,image/jpeg,.jpg,.jpeg,image/svg+xml,.svg`; empty without a store. */
  readonly accept: string
  /** The name of the file being added, from the moment it is chosen until the editor has said what became of it; null otherwise. */
  readonly adding: string | null
  /** Why Add image… does nothing now, while a store is given and it does nothing: an image being added, or a report that holds all it may. */
  readonly unavailable?: string
  /** The report's images, in its order. */
  readonly assets: readonly LibraryAsset[]
}

/** One image the report declares, as its row in the report's properties shows it. */
export interface LibraryAsset {
  readonly id: string
  /** What the row says: "logo (SVG)". */
  readonly label: string
  /** Its Remove button's accessible name: "Remove image logo". */
  readonly removeLabel: string
  /** What draws it, when something does: Remove is then unavailable, and described by this. */
  readonly inUse?: string
}
