/*
 * The client's host (0049): a page that keeps a report's draft on Report's
 * server, with the DOM's types and none of Node's, the module resolution a
 * bundler has, and the packed report-client and what it declares, and
 * nothing else.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from
 * the packed tarballs and type-checked with skipLibCheck OFF; build.mjs
 * then bundles everything report-client exports for a browser, as a page's
 * build would, so a Node built-in in its code fails there. It is not run
 * here, where no server answers: the server's host runs the packed client
 * against the packed server (server.ts). What is on trial: the client's
 * declarations name no Node type and resolve for a bundler; a page's own
 * fetch and token are what it takes; a save is from the `Draft` a read
 * answered or the `DraftSaved` a save did, each as it came; its answers
 * narrow by `ok`, and a refusal by its `code` to the field that code
 * carries; and a file a person chose is bytes it keeps.
 */
import { createReportClient } from '@formancy/report-client'
import type { Answered, ReportClient } from '@formancy/report-client'
import type { Draft, DraftSaved, StoredImage } from '@formancy/report-server-core'
import type { AssetMediaType, ReportDefinition } from '@formancy/report-spec'

/** The session's current token; a page with none has nobody to ask as, and asks nothing. */
function currentToken(): string {
  const held = sessionStorage.getItem('report-token')
  if (held === null) throw new Error('Nobody is signed in.')
  return held
}

/** The client a page makes once: the server it was told of, the session's current token, and the window's own fetch. */
export const reports: ReportClient = createReportClient({ server: 'https://reports.example', token: currentToken, fetch: window.fetch })

/** What a page's Save says of what the server answered: the revision written, or why not, from the field the refusal's code carries. `from` is the draft the page opened, or the one its last save answered. */
export async function save(from: Draft | DraftSaved, report: ReportDefinition): Promise<string> {
  const saved = await reports.saveDraft(from.template, report, from)
  if (saved.ok) return `Saved as revision ${String(saved.value.revision)}.`
  const { refusal } = saved
  switch (refusal.code) {
    case 'draft-changed':
      return refusal.revision === null ? 'This draft is gone.' : `Someone saved revision ${String(refusal.revision)} since you opened it.`
    case 'report-invalid':
      return refusal.errors.map((error) => `${error.path}: ${error.message}`).join('\n')
    case 'asset-not-kept':
      return `Not kept yet: ${refusal.assets.join(', ')}.`
    default:
      return refusal.message
  }
}

/** Keeps the image a person chose, by the digest a report names it by. */
export async function keep(file: File, digest: string, mediaType: AssetMediaType): Promise<string> {
  const kept = await reports.keepImage(new Uint8Array(await file.arrayBuffer()), digest, mediaType)
  return kept.ok ? kept.value.digest : kept.refusal.code === 'image-refused' ? kept.refusal.reason : kept.refusal.message
}

/** A kept image as a page shows it: a blob URL of its bytes, under the type they were kept as. */
export async function show(digest: string): Promise<string | undefined> {
  const read: Answered<StoredImage> = await reports.readImage(digest)
  return read.ok ? URL.createObjectURL(new Blob([new Uint8Array(read.value.bytes)], { type: read.value.mediaType })) : undefined
}
