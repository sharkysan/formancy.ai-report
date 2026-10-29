import { emptyReport, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { RolePolicy } from './actions.js'
import { listTemplates, readDraft, saveDraft } from './drafts.js'
import type { Asking, Precondition } from './drafts.js'
import type { ReportIdentity } from './identity.js'
import type { StoredDraft, StoredImage, TemplateStore } from './store.js'
import { DRAFT_FORMAT, REFUSALS } from './wire.js'

/**
 * The draft use cases (0049): who may list, read and save, and what a save
 * checks, in the order it checks it. They run here against a store in
 * memory, enough to hold what they ask of the port; the file store has its
 * own suite, in report-server, and that is the one a deployment runs.
 */
function memoryStore() {
  const drafts = new Map<string, StoredDraft[]>()
  const images = new Map<string, StoredImage>()
  /** Every call the use cases made on the port, in order: a refusal that comes before the store is asked leaves this empty. */
  const asked: string[] = []
  const key = (tenant: string, name: string): string => JSON.stringify([tenant, name])
  const store: TemplateStore = {
    async list(tenant) {
      asked.push('list')
      return [...drafts].flatMap(([name, history]) => {
        const [owner, template] = JSON.parse(name) as [string, string]
        const newest = history.at(-1)
        return owner === tenant && newest !== undefined ? [{ template, revision: newest.revision, title: newest.report.title }] : []
      })
    },
    async newest(tenant, template) {
      asked.push('newest')
      return drafts.get(key(tenant, template))?.at(-1)
    },
    async save(tenant, template, from, draft) {
      asked.push('save')
      const history = drafts.get(key(tenant, template)) ?? []
      const current = history.at(-1)?.revision ?? null
      if (current !== from) return { saved: false, revision: current }
      const revision = (current ?? 0) + 1
      drafts.set(key(tenant, template), [...history, { revision, ...draft }])
      return { saved: true, revision }
    },
    async keepImage(tenant, digest, image) {
      asked.push('keepImage')
      images.set(key(tenant, digest), image)
    },
    async readImage(tenant, digest) {
      asked.push('readImage')
      return images.get(key(tenant, digest))
    },
    async imageKind(tenant, digest) {
      asked.push('imageKind')
      return images.get(key(tenant, digest))?.mediaType
    },
  }
  /** Everything the store holds, as text: equal before and after a request that must write nothing. */
  const snapshot = (): string => JSON.stringify([[...drafts], [...images]])
  return { store, asked, snapshot }
}

const policy: RolePolicy = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }
const AUTHOR = 'report-authors'
const PUBLISHER = 'report-publishers'
const ADMIN = 'report-admins'

/** Who asks: a subject of a tenant holding `role`, or none. */
const asking = (store: TemplateStore, role?: string, who: Partial<ReportIdentity> = {}): Asking => ({
  identity: { subject: 'u-1', tenant: 'acme', roles: role === undefined ? [] : [role], ...who },
  roles: policy,
  store,
})

const none: Precondition = { kind: 'none' }
const create: Precondition = { kind: 'create' }
const replace = (revision: number): Precondition => ({ kind: 'replace', revision })

const report = (id = 'invoice'): ReportDefinition => emptyReport(id, 'Invoice', 'en')
const LOGO = `sha256:${'ab'.repeat(32)}`
const SEAL = `sha256:${'cd'.repeat(32)}`
const BRAND = `sha256:${'ef'.repeat(32)}`
const png: StoredImage = { mediaType: 'image/png', bytes: Uint8Array.of(1) }

describe('listTemplates', () => {
  // The wire says "by id". A store lists in the order its medium does -- a
  // directory's, a table's -- so a use case that passed it on would give two
  // deployments two orders, and a client that rendered the list as it came
  // would shuffle it.
  test('lists the tenant\'s templates by id, whatever order the store gives them in', async () => {
    const { store } = memoryStore()
    for (const id of ['zeta', 'alpha', 'mid']) await saveDraft(asking(store, AUTHOR), id, report(id), create)
    await saveDraft(asking(store, AUTHOR, { tenant: 'other' }), 'beta', report('beta'), create)
    const listed = await listTemplates(asking(store, ADMIN))
    expect(listed).toEqual({
      ok: true,
      status: 200,
      body: {
        templates: [
          { template: 'alpha', revision: 1, title: 'Invoice' },
          { template: 'mid', revision: 1, title: 'Invoice' },
          { template: 'zeta', revision: 1, title: 'Invoice' },
        ],
      },
    })
  })

  // A tenant with nothing saved is not an error: a builder opening an empty
  // account must be told so, and a 404 would read as a wrong path.
  test('answers an empty list for a tenant with no template', async () => {
    const { store } = memoryStore()
    expect(await listTemplates(asking(store, AUTHOR))).toEqual({ ok: true, status: 200, body: { templates: [] } })
  })

  // Anybody holding a capacity sees what exists (the actions table); one
  // holding none sees nothing, and the store is not asked, so the refusal
  // cannot tell a tenant with templates from one without.
  test('refuses a token with no capacity as forbidden, without asking the store', async () => {
    const { store, asked } = memoryStore()
    expect(await listTemplates(asking(store))).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    expect(await listTemplates(asking(store, 'somebody-else'))).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    expect(asked).toEqual([])
  })
})

describe('readDraft', () => {
  // The newest draft is served with its revision twice: in the body for a
  // client and beside it for the route's ETag. A save of revision 1 read as
  // revision 2, or a revision missing from the answer, would have the
  // route send an ETag the next If-Match is refused by.
  test('serves the newest draft with its revision, who saved it and the report', async () => {
    const { store } = memoryStore()
    await saveDraft(asking(store, AUTHOR, { subject: 'u-1' }), 'invoice', report(), create)
    const changed = { ...report(), title: 'Invoice, second' }
    await saveDraft(asking(store, AUTHOR, { subject: 'u-2' }), 'invoice', changed, replace(1))
    expect(await readDraft(asking(store, PUBLISHER), 'invoice')).toEqual({
      ok: true,
      status: 200,
      body: { format: DRAFT_FORMAT, template: 'invoice', revision: 2, savedBy: 'u-2', report: changed },
      revision: 2,
    })
  })

  // A template nobody saved is a 404 of its own code, so that a builder can
  // tell "start a new template" from "the path is wrong".
  test('answers 404 no-draft for a template with no draft', async () => {
    const { store } = memoryStore()
    expect(await readDraft(asking(store, AUTHOR), 'invoice')).toEqual({ ok: false, status: 404, body: REFUSALS['no-draft'] })
  })

  // The template id is a path segment the store turns into a name on a
  // disk: an id the format does not allow is refused before the store is
  // asked, whatever it would have named.
  test('refuses an id the format does not allow as template-id-invalid, without asking the store', async () => {
    const { store, asked } = memoryStore()
    for (const id of ['', 'Invoice', '../etc', 'a/b', '1invoice', 'a'.repeat(65)]) {
      expect(await readDraft(asking(store, AUTHOR), id), id).toEqual({ ok: false, status: 400, body: REFUSALS['template-id-invalid'] })
    }
    expect(asked).toEqual([])
  })

  // A publisher reads what an author wrote (the actions table); an
  // administrator manages who may render and has no business in the text.
  // The refusal comes before the store is asked, so it cannot say whether
  // the draft exists.
  test('lets a publisher read and refuses an administrator and a token with no capacity', async () => {
    const { store, asked } = memoryStore()
    await saveDraft(asking(store, AUTHOR), 'invoice', report(), create)
    const before = asked.length
    expect((await readDraft(asking(store, PUBLISHER), 'invoice')).ok).toBe(true)
    const afterOne = asked.length
    expect(await readDraft(asking(store, ADMIN), 'invoice')).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    expect(await readDraft(asking(store), 'missing')).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    expect(afterOne).toBeGreaterThan(before)
    expect(asked.length).toBe(afterOne)
  })

  // Tenants are separate by the identity alone: a template of another
  // tenant, and of one whose name differs only by case, is not found, and
  // is not forbidden either, which would say it exists.
  test('reads only the asking tenant\'s drafts', async () => {
    const { store } = memoryStore()
    await saveDraft(asking(store, AUTHOR, { tenant: 'acme' }), 'invoice', report(), create)
    for (const tenant of ['other', 'Acme', 'acme ']) {
      expect(await readDraft(asking(store, AUTHOR, { tenant }), 'invoice'), tenant).toEqual({ ok: false, status: 404, body: REFUSALS['no-draft'] })
    }
  })
})

describe('saveDraft', () => {
  // The first save of a template: 201 and revision 1, written under the
  // token's tenant and subject. A 200 would tell a client it replaced
  // something, and a savedBy taken from anywhere but the verified identity
  // would let a body say who wrote it.
  test('creates a template at revision 1, saved by the token\'s subject', async () => {
    const { store } = memoryStore()
    const saved = await saveDraft(asking(store, AUTHOR, { subject: 'u-7' }), 'invoice', report(), create)
    expect(saved).toEqual({ ok: true, status: 201, body: { template: 'invoice', revision: 1 }, revision: 1 })
    expect(await store.newest('acme', 'invoice')).toEqual({ revision: 1, savedBy: 'u-7', report: report() })
  })

  // A replace is 200, and the revision it wrote is the next, so that the
  // client's next If-Match names it.
  test('replaces the revision it names, answering 200 and the next revision', async () => {
    const { store } = memoryStore()
    await saveDraft(asking(store, AUTHOR), 'invoice', report(), create)
    const saved = await saveDraft(asking(store, AUTHOR), 'invoice', { ...report(), title: 'Changed' }, replace(1))
    expect(saved).toEqual({ ok: true, status: 200, body: { template: 'invoice', revision: 2 }, revision: 2 })
    expect((await store.newest('acme', 'invoice'))?.report.title).toBe('Changed')
  })

  // Two saves from nothing: one wins. The second is told which revision
  // stands, so it can read and decide; if it were written over the first, a
  // person's work would be lost without either of them being told. The
  // revision is beside the body too, for the route's ETag, which is where
  // HTTP says a failed precondition names what stands (RFC 9110): without
  // it, a client reading the ETag after a 412 would find none.
  test('refuses a second create as draft-changed, naming the revision that stands, and writes nothing', async () => {
    const { store, snapshot } = memoryStore()
    expect((await saveDraft(asking(store, AUTHOR), 'invoice', report(), create)).status).toBe(201)
    const before = snapshot()
    const second = await saveDraft(asking(store, AUTHOR), 'invoice', { ...report(), title: 'Other' }, create)
    expect(second).toStrictEqual({ ok: false, status: 412, body: { ...REFUSALS['draft-changed'], revision: 1 }, revision: 1 })
    expect(snapshot()).toBe(before)
  })

  // A replace of a revision that is not the newest is the same lost swap,
  // with the newest named, in the body and for the ETag.
  test('refuses a replace of a stale revision as draft-changed, naming the newest', async () => {
    const { store } = memoryStore()
    await saveDraft(asking(store, AUTHOR), 'invoice', report(), create)
    await saveDraft(asking(store, AUTHOR), 'invoice', report(), replace(1))
    const stale = await saveDraft(asking(store, AUTHOR), 'invoice', report(), replace(1))
    expect(stale).toStrictEqual({ ok: false, status: 412, body: { ...REFUSALS['draft-changed'], revision: 2 }, revision: 2 })
  })

  // A replace of a template that has no draft stands on nothing: 412 with no
  // revision, not a create by the back door, which would let a stale tab
  // resurrect a template after the draft it replaced went. No revision
  // stands, so there is none for an ETag either: a route that sent one would
  // name a draft that does not exist.
  test('refuses a replace of a template with no draft as draft-changed with no revision', async () => {
    const { store } = memoryStore()
    const saved = await saveDraft(asking(store, AUTHOR), 'invoice', report(), replace(1))
    expect(saved).toStrictEqual({ ok: false, status: 412, body: { ...REFUSALS['draft-changed'], revision: null } })
    expect(await store.newest('acme', 'invoice')).toBeUndefined()
  })

  // A save with no precondition is 428: the server never decides for the
  // client whether it meant to create or to replace. It is refused before
  // the body is read, so a body that is no report is not told so first.
  test('refuses a save with no precondition as precondition-required, before it looks at the body', async () => {
    const { store, asked } = memoryStore()
    expect(await saveDraft(asking(store, AUTHOR), 'invoice', { not: 'a report' }, none)).toEqual({ ok: false, status: 428, body: REFUSALS['precondition-required'] })
    expect(asked).toEqual([])
  })

  // A revision is a positive safe integer. The route parses one from a
  // header; a number that is none must not reach a store that names a file
  // by it, and is no precondition.
  test('takes a revision that is not a positive safe integer for no precondition', async () => {
    const { store, asked } = memoryStore()
    for (const revision of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(await saveDraft(asking(store, AUTHOR), 'invoice', report(), replace(revision)), String(revision)).toEqual({ ok: false, status: 428, body: REFUSALS['precondition-required'] })
    }
    expect(asked).toEqual([])
  })

  // A precondition of a kind this code does not know -- a caller written
  // for a later release, or a cast -- is refused as none, never read as a
  // create or a replace: a save that guessed would overwrite.
  test('takes a precondition of an unknown kind for none', async () => {
    const { store, asked } = memoryStore()
    const unknown = { kind: 'always' } as unknown as Precondition
    expect(await saveDraft(asking(store, AUTHOR), 'invoice', report(), unknown)).toEqual({ ok: false, status: 428, body: REFUSALS['precondition-required'] })
    expect(asked).toEqual([])
  })

  // An author saves; a publisher reads what authors write and cannot change
  // it, and an administrator or a token with no capacity cannot either.
  test('lets an author save and refuses a publisher, an administrator and a token with no capacity as forbidden, writing nothing', async () => {
    const { store, asked, snapshot } = memoryStore()
    expect((await saveDraft(asking(store, AUTHOR), 'invoice', report(), create)).ok).toBe(true)
    const before = snapshot()
    const askedBefore = asked.length
    for (const role of [PUBLISHER, ADMIN, undefined]) {
      expect(await saveDraft(asking(store, role), 'invoice', report(), replace(1)), String(role)).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    }
    expect(snapshot()).toBe(before)
    expect(asked.length).toBe(askedBefore)
  })

  // The template id is a path segment: one the format does not allow is
  // refused as the id, before anything else of the request is judged.
  test('refuses an id the format does not allow as template-id-invalid', async () => {
    const { store, asked } = memoryStore()
    for (const id of ['', 'Invoice', '../etc', 'a b']) {
      expect(await saveDraft(asking(store, AUTHOR), id, report(), create), id).toEqual({ ok: false, status: 400, body: REFUSALS['template-id-invalid'] })
    }
    expect(asked).toEqual([])
  })

  // The format's own errors travel back to the requester under their own
  // token, where the builder can point at them; the draft is not stored.
  test('refuses a report the format rejects as report-invalid, with report-spec\'s errors, and writes nothing', async () => {
    const { store, snapshot } = memoryStore()
    const bad = { ...report(), locale: 'english' }
    const outcome = validateReport(bad)
    if (outcome.valid) throw new Error('the fixture is meant to be invalid')
    const before = snapshot()
    expect(await saveDraft(asking(store, AUTHOR), 'invoice', bad, create)).toEqual({ ok: false, status: 422, body: { ...REFUSALS['report-invalid'], errors: outcome.errors } })
    expect(outcome.errors.map((error) => error.path)).toContain('/locale')
    expect(snapshot()).toBe(before)
  })

  // A body that is not an object at all is still the format's refusal, not a
  // crash: the route hands over whatever JSON parsed to.
  test('refuses a body that is no object as report-invalid', async () => {
    const { store } = memoryStore()
    for (const body of [undefined, null, 'text', 3, []]) {
      const saved = await saveDraft(asking(store, AUTHOR), 'invoice', body, create)
      expect(saved.ok, String(body)).toBe(false)
      expect(saved.ok ? undefined : saved.body.code, String(body)).toBe('report-invalid')
      expect(saved.ok ? undefined : saved.status, String(body)).toBe(422)
    }
  })

  // The path names the template and the report names itself; one saved
  // under the other's id would be listed under an id its own text denies.
  test('refuses a report whose id is not the template\'s as template-id-mismatch, writing nothing', async () => {
    const { store } = memoryStore()
    expect(await saveDraft(asking(store, AUTHOR), 'invoice', report('quote'), create)).toEqual({ ok: false, status: 422, body: REFUSALS['template-id-mismatch'] })
    expect(await store.list('acme')).toEqual([])
  })

  // A draft that names an image the tenant has not kept would be
  // published with a hole in it. The refusal names the asset by the id the
  // report gives it, which is the requester's own word, and not the digest.
  test('refuses a draft whose image is not kept, naming it by its id', async () => {
    const { store } = memoryStore()
    const draft = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: LOGO }] }
    expect(await saveDraft(asking(store, AUTHOR), 'invoice', draft, create)).toEqual({ ok: false, status: 422, body: { ...REFUSALS['asset-not-kept'], assets: ['logo'] } })
    expect(await store.newest('acme', 'invoice')).toBeUndefined()
  })

  // The same draft saves once its image is kept; if the check read the
  // wrong tenant, or the id instead of the digest, this would still refuse.
  test('saves a draft whose images are all kept by the asking tenant', async () => {
    const { store } = memoryStore()
    await store.keepImage('acme', LOGO, png)
    const draft = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: LOGO }] }
    expect((await saveDraft(asking(store, AUTHOR), 'invoice', draft, create)).ok).toBe(true)
  })

  // An image another tenant kept is not this tenant's: the digest is the
  // same bytes, but a draft that rested on it would break the day that
  // tenant removed it, and would show that it exists. The tenant that kept
  // it saves, so the question is asked of the token's tenant and not of a
  // fixed one.
  test('takes an image from the asking tenant\'s own and not from another\'s', async () => {
    const { store } = memoryStore()
    await store.keepImage('other', LOGO, png)
    const draft = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: LOGO }] }
    const saved = await saveDraft(asking(store, AUTHOR), 'invoice', draft, create)
    expect(saved).toEqual({ ok: false, status: 422, body: { ...REFUSALS['asset-not-kept'], assets: ['logo'] } })
    expect((await saveDraft(asking(store, AUTHOR, { tenant: 'other' }), 'invoice', draft, create)).ok).toBe(true)
  })

  // A draft that declares a kept PNG as an SVG, by its digest, names bytes
  // the store holds, but the runtime refuses at print an asset whose bytes
  // are not the kind it declares: saved, it could never print, the hole a
  // draft that declares a font is refused to avoid. An image counts as kept
  // only as the kind it was kept as, so a hand-made save that declares
  // another is refused as an image not kept, by its id, and the same draft
  // declaring the kept kind saves.
  test('refuses a draft that declares a kept image as another kind, naming it as not kept', async () => {
    const { store } = memoryStore()
    await store.keepImage('acme', LOGO, png)
    for (const mediaType of ['image/svg+xml', 'image/jpeg'] as const) {
      const draft = { ...report(), assets: [{ id: 'logo', mediaType, digest: LOGO }] }
      expect(await saveDraft(asking(store, AUTHOR), 'invoice', draft, create), mediaType).toEqual({ ok: false, status: 422, body: { ...REFUSALS['asset-not-kept'], assets: ['logo'] } })
    }
    expect(await store.newest('acme', 'invoice')).toBeUndefined()
    const declared = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: LOGO }] }
    expect((await saveDraft(asking(store, AUTHOR), 'invoice', declared, create)).ok).toBe(true)
  })

  // Every asset the store lacks is listed, once, in a stable order: a list
  // in the report's order would change with an edit that moved an asset,
  // and one that stopped at the first would take as many saves as images.
  test('lists every image not kept, sorted by id, and leaves out the ones that are', async () => {
    const { store } = memoryStore()
    await store.keepImage('acme', SEAL, png)
    const draft = {
      ...report(),
      assets: [
        { id: 'zebra', mediaType: 'image/jpeg' as const, digest: `sha256:${'01'.repeat(32)}` },
        { id: 'seal', mediaType: 'image/png' as const, digest: SEAL },
        { id: 'apple', mediaType: 'image/svg+xml' as const, digest: LOGO },
      ],
    }
    const saved = await saveDraft(asking(store, AUTHOR), 'invoice', draft, create)
    expect(saved).toEqual({ ok: false, status: 422, body: { ...REFUSALS['asset-not-kept'], assets: ['apple', 'zebra'] } })
  })

  // This server keeps no font: a draft with a font map could be saved and then
  // never rendered with the face it names. It is refused now, so every
  // stored draft can be published later. The store is not consulted for a
  // font, and holding that digest as an image would change nothing.
  test('refuses a draft that declares a font, whatever the store holds under its digest', async () => {
    const { store } = memoryStore()
    await store.keepImage('acme', BRAND, png)
    const draft: ReportDefinition = { ...report(), assets: [{ id: 'brand', mediaType: 'font/ttf', digest: BRAND }], fonts: { sans: { normal: 'brand' } } }
    expect(validateReport(draft).valid).toBe(true)
    const saved = await saveDraft(asking(store, AUTHOR), 'invoice', draft, create)
    expect(saved).toEqual({ ok: false, status: 422, body: { ...REFUSALS['asset-not-kept'], assets: ['brand'] } })
    expect(await store.newest('acme', 'invoice')).toBeUndefined()
  })

  // The stored report is the one the validator returned, which shares no
  // object with the body: a caller that changes its body after the save
  // must not change the draft.
  test('stores a copy of the report, not the object it was handed', async () => {
    const { store } = memoryStore()
    const body = report()
    await saveDraft(asking(store, AUTHOR), 'invoice', body, create)
    ;(body as { title: string }).title = 'Changed after the save'
    expect((await store.newest('acme', 'invoice'))?.report.title).toBe('Invoice')
  })

  // The checks run in one order, so that a client is told one thing at a
  // time and the cheapest, the one that reveals least, first. Each request
  // below fails its own check and every check after it; removing the fault
  // moves the refusal to the next.
  test('judges a request in the order authority, id, precondition, format, id match, images, then the revision', async () => {
    const { store } = memoryStore()
    await store.keepImage('acme', LOGO, png)
    const unkept = { ...report('quote'), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: SEAL }] }
    const steps: readonly [string, Asking, string, unknown, Precondition, number, string][] = [
      ['authority', asking(store, PUBLISHER), 'Bad Id', {}, none, 403, 'forbidden'],
      ['id', asking(store, AUTHOR), 'Bad Id', {}, none, 400, 'template-id-invalid'],
      ['precondition', asking(store, AUTHOR), 'invoice', {}, none, 428, 'precondition-required'],
      ['format', asking(store, AUTHOR), 'invoice', {}, create, 422, 'report-invalid'],
      ['id match', asking(store, AUTHOR), 'invoice', unkept, create, 422, 'template-id-mismatch'],
      ['images', asking(store, AUTHOR), 'quote', unkept, replace(5), 422, 'asset-not-kept'],
      ['revision', asking(store, AUTHOR), 'quote', report('quote'), replace(5), 412, 'draft-changed'],
    ]
    for (const [name, who, template, body, precondition, status, code] of steps) {
      const answered = await saveDraft(who, template, body, precondition)
      expect({ name, ok: answered.ok, status: answered.status, code: answered.ok ? undefined : answered.body.code }, name).toEqual({ name, ok: false, status, code })
    }
  })
})
