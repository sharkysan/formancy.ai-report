/**
 * Add image… and the file input beside it, beyond what the shared
 * scenarios ask (0033): the file taken before the input is cleared, the
 * same file chosen twice, a chooser closed without one, the keyboard on
 * the button throughout, and the keys that open the chooser.
 *
 * These read the DOM for the input, which has no role, and replace its
 * `files` and `value` with what a browser's do: jsdom's `value = ''` leaves
 * a `files` that Testing Library installed in place, so without them a
 * builder that cleared the input before it took the file would pass here
 * and add nothing in a browser.
 */
import { editorText, SCENARIO_PNG, SCENARIO_PNG_DIGEST, scenarioReport } from '@formancy/report-builder-core'
import type { AddedImage, ImageStore, KeptImage } from '@formancy/report-builder-core'
import { MAX_ASSETS } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { choose, fileInputOf, mount } from './test-support.js'

afterEach(cleanup)

const t = editorText('en')
const addImage = (): HTMLElement => screen.getByRole('button', { name: t('images.add') })
const status = (): HTMLElement => screen.getByRole('status', { name: '' })
const logo = (): File => new File([Uint8Array.from(SCENARIO_PNG)], 'logo.png', { type: 'image/png' })

/** A store that keeps every image, and what it kept; or, given `held`, answers each only when the test lets it. */
function keeping(held?: Promise<KeptImage>): ImageStore & { readonly kept: AddedImage[] } {
  const kept: AddedImage[] = []
  return {
    kept,
    async keep(image) {
      kept.push(image)
      return held ?? { ok: true }
    },
  }
}

/**
 * `input`'s `files` and `value` as a browser has them: setting the value
 * to nothing empties the files. Every read of `files` and write of `value`
 * is logged, in order.
 */
function asInABrowser(input: HTMLInputElement): { readonly pick: (file: File) => void; readonly log: string[] } {
  const log: string[] = []
  let files: File[] = []
  Object.defineProperty(input, 'files', {
    configurable: true,
    get: () => {
      log.push('files read')
      return files
    },
  })
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => (files[0] === undefined ? '' : `C:\\fakepath\\${files[0].name}`),
    set: (value: string) => {
      log.push(`value set to ${JSON.stringify(value)}`)
      if (value === '') files = []
    },
  })
  return {
    log,
    pick(file) {
      files = [file]
      fireEvent.input(input)
      fireEvent.change(input)
    },
  }
}

/** The scenario report declaring as many images as a report may: room for none more. */
function full(): ReportDefinition {
  const report = scenarioReport()
  return { ...report, assets: Array.from({ length: MAX_ASSETS }, (_, at) => ({ id: `image-${String(at)}`, mediaType: 'image/png' as const, digest: `sha256:${at.toString(16).padStart(64, '0')}` })) }
}

describe('Add image…', () => {
  // In a browser, clearing the input's value empties its files: a builder
  // that cleared it first would hand the editor nothing, and every add
  // would end before it began, with no word in the live region.
  test('takes the file chosen before it clears the input, and clears it so the same file is a change again', async () => {
    const store = keeping()
    const { user, session } = mount(scenarioReport(), 'en', undefined, store)
    const browser = asInABrowser(fileInputOf(addImage()))
    await user.click(addImage())
    browser.pick(logo())
    await waitFor(() => expect(session.document().assets).toEqual([{ id: 'logo', mediaType: 'image/png', digest: SCENARIO_PNG_DIGEST }]))
    expect(browser.log).toEqual(['files read', 'value set to ""'])
    // The same file again: a change, since the value was cleared, and the editor says the report holds it, handing the host its bytes again under that id.
    await user.click(addImage())
    browser.pick(logo())
    await waitFor(() => expect(status().textContent).toBe(t('images.already', { id: 'logo' })))
    expect(store.kept.map((image) => image.asset)).toEqual(['logo', 'logo'])
    expect(session.document().assets).toHaveLength(1)
  })

  // A chooser closed without a file is no add: nothing is said, nothing kept.
  test('does nothing when the chooser closes without a file', async () => {
    const store = keeping()
    const { user, editor } = mount(scenarioReport(), 'en', undefined, store)
    const browser = asInABrowser(fileInputOf(addImage()))
    await user.click(addImage())
    const before = editor.state().status
    fireEvent.change(fileInputOf(addImage()))
    expect(browser.log).toEqual(['files read', 'value set to ""'])
    expect(editor.state().status).toBe(before)
    expect(store.kept).toEqual([])
  })

  // The input never has focus and the button is never redrawn as another:
  // the keyboard is where the person pressed, while the image is added and
  // once it is, so a second press needs no search for the button.
  test('keeps the keyboard on the button while the image is added and after', async () => {
    let release = (_: KeptImage): void => undefined
    const store = keeping(new Promise<KeptImage>((resolve) => (release = resolve)))
    const { user } = mount(scenarioReport(), 'en', undefined, store)
    await user.click(addImage())
    choose(fileInputOf(addImage()), logo())
    await waitFor(() => expect(addImage().getAttribute('aria-busy')).toBe('true'))
    expect(document.activeElement).toBe(addImage())
    await act(async () => release({ ok: true }))
    await waitFor(() => expect(status().textContent).toBe(t('images.added', { id: 'logo', kind: t('kind.image') })))
    expect(addImage().hasAttribute('aria-busy')).toBe(false)
    expect(document.activeElement).toBe(addImage())
  })

  // Enter and Space open the chooser as a click does: the keyboard's path
  // to a file (formancy.ai 0046), which a chooser opened only by a pointer
  // would leave without one.
  test('opens the chooser on Enter and on Space', async () => {
    const { user } = mount(scenarioReport(), 'en', undefined, keeping())
    const input = fileInputOf(addImage())
    let opened = 0
    input.addEventListener('click', () => (opened += 1))
    act(() => addImage().focus())
    await user.keyboard('{Enter}')
    expect(opened).toBe(1)
    await user.keyboard(' ')
    expect(opened).toBe(2)
  })

  // A report holding all the images it may: the button says why, and
  // pressing it says so again and opens no chooser for a file the editor
  // would refuse after the person picked it.
  test('opens no chooser where the editor takes no file, and says why', async () => {
    const { user } = mount(full(), 'en', undefined, keeping())
    const input = fileInputOf(addImage())
    let opened = 0
    input.addEventListener('click', () => (opened += 1))
    const why = t('images.full', { count: String(MAX_ASSETS) })
    expect(addImage().getAttribute('aria-disabled')).toBe('true')
    expect(computeAccessibleDescription(addImage())).toBe(why)
    await user.click(addImage())
    expect(opened).toBe(0)
    expect(status().textContent).toBe(why)
  })

  // Where the host keeps no images there is nothing to open: no button,
  // and no input a script could still hand a file to.
  test('is not drawn, nor its input, where the host keeps no images', () => {
    const { view } = mount(scenarioReport())
    expect(screen.queryByRole('button', { name: t('images.add') })).toBeNull()
    expect(view.container.querySelector('input[type="file"]')).toBeNull()
  })

  // The chooser offers what the host keeps, by type and by name: a host
  // that keeps PNG alone is offered no SVG to refuse after it is picked.
  test('offers the types the host keeps', () => {
    mount(scenarioReport(), 'en', undefined, { accept: ['image/png'], keep: async () => ({ ok: true }) })
    expect(fileInputOf(addImage()).accept).toBe('image/png,.png')
  })
})
