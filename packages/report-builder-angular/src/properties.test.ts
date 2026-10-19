/**
 * The properties pane: a native control for every field of every kind of
 * component, each found by the role report-builder-core gives its kind and
 * by its label, and the rules for when a field commits.
 */
import { TestBed } from '@angular/core/testing'
import { createReportEditor, editorText, PROPERTY_KINDS, PROPERTY_ROLES, scenarioReport } from '@formancy/report-builder-core'
import { COMPONENT_KINDS, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { fireEvent, screen, within } from '@testing-library/angular'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountScenarioBuilder } from './test-mount'
import { audit, richSession, sessionOver } from './test-support'
import { click, fill, press } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

const t = editorText('en')

/** The scenario report declaring two images, `logo`, which its report header draws, and `spare`, which nothing draws. */
function twoImages(): ReportDefinition {
  const report = scenarioReport()
  return {
    ...report,
    assets: [
      { id: 'logo', mediaType: 'image/svg+xml', digest: `sha256:${'ab'.repeat(32)}` },
      { id: 'spare', mediaType: 'image/png', digest: `sha256:${'cd'.repeat(32)}` },
    ],
    regions: { ...report.regions, reportHeader: [{ id: 'mark', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 40, height: 40, fit: 'contain' }] },
  }
}

describe('the report’s images', () => {
  // Listed with the report's own properties, each by its id and kind; an
  // image something draws cannot be removed from under it, and its Remove
  // says so before it is pressed -- unavailable, described by what draws
  // it -- where one that looked like any other would only say so after.
  test('are listed under the report’s fields, the Remove of one something draws unavailable and described by what draws it', async () => {
    const { settle } = await mountBuilder(createReportEditor(sessionOver(twoImages())))
    const images = within(screen.getByRole('form', { name: t('properties.report') })).getByRole('group', { name: t('images.heading') })
    expect(images.textContent).toContain('logo (SVG)')
    expect(images.textContent).toContain('spare (PNG)')
    const logo = within(images).getByRole('button', { name: t('images.removeOne', { id: 'logo' }) })
    expect(logo.getAttribute('aria-disabled')).toBe('true')
    expect(computeAccessibleDescription(logo)).toBe(t('images.inUse', { names: t('label.kindDetail', { kind: t('kind.image'), detail: 'logo' }) }))
    const spare = within(images).getByRole('button', { name: t('images.removeOne', { id: 'spare' }) })
    expect(spare.hasAttribute('aria-disabled')).toBe(false)
    expect(computeAccessibleDescription(spare)).toBe('')
    // Selecting a component shows its fields, and the report's images go with the report's.
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    expect(screen.queryByRole('group', { name: t('images.heading') })).toBeNull()
  })

  // A report with no image has no list to show: no empty group named
  // Images for a screen reader to stop at.
  test('are not listed where the report has none', async () => {
    await mountScenarioBuilder()
    expect(screen.queryByRole('group', { name: t('images.heading') })).toBeNull()
  })
})

describe('the properties pane', () => {
  // A field drawn as the wrong control -- a length as a text box, a style
  // as a text box rather than a choice -- is one the scenarios find by
  // role would miss, and one a screen reader announces as something it is
  // not. Every row of a report holding every kind is selected in turn, the
  // report itself first, and every field is found by role and name. The
  // page is audited as it stands for the first selection of each kind: the
  // panel is drawn by kind, and a second text audits what the first did.
  test('draws every field of every kind as its role’s native control, labelled, and accessible', async () => {
    const editor = createReportEditor(richSession())
    const { settle } = await mountBuilder(editor)
    const kinds = new Set<string>()
    const audited = new Set<string>()
    const check = async (): Promise<void> => {
      for (const field of editor.state().properties.fields) {
        kinds.add(field.kind)
        const control = screen.getByRole(PROPERTY_ROLES[field.kind], { name: field.label })
        if (field.kind === 'boolean') expect((control as HTMLInputElement).checked, field.label).toBe(field.value)
        else expect((control as HTMLInputElement).value, field.label).toBe(field.value)
      }
      const drawn = editor.state().properties.fields.map((field) => `${field.kind} ${field.label}`).join()
      if (audited.has(drawn)) return
      audited.add(drawn)
      expect(await audit(), editor.state().properties.heading).toEqual([])
    }
    await check()
    for (const row of screen.getAllByRole('treeitem')) {
      click(row)
      await settle()
      await check()
    }
    // The report holds every kind there is, or this proved less than it says:
    // every kind of field, and every kind of component the format has.
    expect(kinds).toEqual(new Set(PROPERTY_KINDS))
    expect(new Set(walkComponents(richSession().document()).map(({ component }) => component.kind))).toEqual(new Set(COMPONENT_KINDS))
    // About twenty selections and a dozen audits: 7.2 s in a full parallel
    // run on a Windows laptop on 15 October 2026, which a runner fourteen
    // times slower (vitest.config.ts) would take past 100 s.
  }, 150_000)

  // Enter in a single-line field commits, and the browser's change event
  // follows it when the field is left. Sent again, the value is one the
  // session already has: no step, but a second "Changed Title." for a
  // screen reader, as if a second edit had been made. Never sent at all,
  // Enter would do nothing a person can see.
  test('commits a single-line field on Enter, once', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const said: string[] = []
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) said.push(node.textContent ?? '')
    }).observe(screen.getByRole('status', { name: '' }), { childList: true })
    const title = screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement
    const before = editor.state().revision
    title.focus()
    title.value = 'Site visit, Bern'
    press('Enter')
    await settle()
    expect(editor.state().document.title).toBe('Site visit, Bern')
    fireEvent.change(title)
    title.blur()
    await settle()
    expect(editor.state().revision).toBe(before + 1)
    expect(said).toEqual(['Changed Title.'])
  })

  // Escape in a field gives back what the report holds, as it does in the
  // React builder. Kept as typed, the draft would be committed the moment
  // the person moved on, whatever they meant by pressing Escape.
  test('gives back what the report holds on Escape, so leaving the field commits nothing', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const title = screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement
    title.focus()
    fireEvent.input(title, { target: { value: 'Changed' } })
    press('Escape')
    expect(title.value).toBe('Site visit')
    // A browser fires no change for a value back as it was; one that did would commit nothing.
    fireEvent.change(title)
    title.blur()
    await settle()
    expect(editor.state().document.title).toBe('Site visit')
    expect(editor.state().revision).toBe(0)
  })

  // A required field says so to assistive technology, as React's do; the
  // pane is a form named by its heading, so a screen reader can jump to it.
  test('is a form named by its heading, its required fields marked required', async () => {
    const { settle } = await mountScenarioBuilder()
    expect(screen.getByRole('form', { name: 'Report' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).required).toBe(true)
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    expect(screen.getByRole('form', { name: 'Text: Introduction' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Show only when' }) as HTMLInputElement).required).toBe(false)
  })

  // A checkbox is a choice made, not text being typed: it commits as it
  // changes.
  test('commits a checkbox as it changes', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Findings' }))
    await settle()
    click(screen.getByRole('checkbox', { name: 'Keep with next' }))
    await settle()
    expect(editor.state().properties.fields.find((field) => field.label === 'Keep with next')?.value).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Keep with next' })).toHaveProperty('checked', true)
  })

  // What was typed and refused is what the person corrects; replaced by the
  // stored value, it would be retyped from nothing, and the error would
  // describe a value no longer shown.
  test('keeps a refused value as typed, with the reason under it', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Spacer' }))
    await settle()
    fill(screen.getByRole('spinbutton', { name: 'Height (mm)' }), '400')
    await settle()
    const height = screen.getByRole('spinbutton', { name: 'Height (mm)' }) as HTMLInputElement
    const reason = editor.state().properties.fields.find((field) => field.label === 'Height (mm)')?.error ?? ''
    expect(reason).not.toBe('')
    expect(height.value).toBe('400')
    expect(height.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(reason).id).toBe(height.getAttribute('aria-describedby'))
  })

  // A field of the next selection drawn in the control the last one used
  // would show what was typed there, uncommitted, as the new component's --
  // wherever the two components' stored values are the same, which nothing
  // re-renders. Both texts here show without a condition.
  test('shows the next selection’s values, not what was typed for the last', async () => {
    const { settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    const condition = screen.getByRole('textbox', { name: 'Show only when' }) as HTMLInputElement
    expect(condition.value).toBe('')
    condition.value = 'params.typed && never.committed'
    click(screen.getByRole('treeitem', { name: 'Note' }))
    await settle()
    expect((screen.getByRole('textbox', { name: 'Show only when' }) as HTMLInputElement).value).toBe('')
  })
})
