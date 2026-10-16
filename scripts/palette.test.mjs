import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * The admin's palette, copied by hand into every app here, held to one value
 * per variable: formancy.ai-data's guard, brought with the Studio.
 *
 * CLAUDE.md asks each UI to wear formancy.ai's admin.css variables, and an
 * application's stylesheet is not a package this repository can depend on,
 * so each app copies them. One copy today, the Studio's.
 *
 * admin.css is in no package: it lives in formancy.ai's repository, and a
 * test here would need the network, or a checkout of that repository beside
 * this one, to read it -- CI has neither. So its values are pinned below,
 * read from the file at the commit formancy.ai v0.5.0 was tagged from
 * (e3c5967), and every copy is held to the pin. When admin.css moves there,
 * the pin and the copies move here by hand, in one commit that names the
 * new commit; what this cannot see is admin.css moving without anybody
 * noticing, which is formancy.ai-data's gap too.
 *
 * What it can check besides: that the workbench variables a copy sets are
 * the ones the installed workbench.css declares, and all of its colours, so
 * a workbench that adds a colour does not dress the builder in its light
 * default inside the dark room.
 *
 * Which files are copies is derived, never listed: every stylesheet under
 * apps/ whose `:root` block carries the comment naming admin.css.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The comment each copy opens its variables with, which is what makes it a copy. */
const MARK = '/* formancy.ai apps/admin/src/admin.css */'

/** Installed, built or measured, never written. */
const SKIP = new Set(['node_modules', 'dist', 'coverage'])

/** Every `.css` file under apps/, as a path from the repository root and its text. */
function stylesheets() {
  const found = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue
      const full = join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.css')) found.push({ path: relative(repo, full).replaceAll('\\', '/'), text: readFileSync(full, 'utf8') })
    }
  }
  walk(join(repo, 'apps'))
  return found
}

/**
 * The custom properties of the `:root` block that carries `mark` -- or of
 * the first `:root` block when `mark` is null -- by name, each value with its
 * whitespace collapsed and comments removed: what the browser would compute,
 * not how the file happens to be laid out.
 */
function palette(text, mark = MARK) {
  for (const match of text.matchAll(/:root\s*\{([^}]*)\}/g)) {
    const body = match[1] ?? ''
    if (mark !== null && !body.includes(mark)) continue
    const declarations = body.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    return Object.fromEntries(
      [...declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, String(value).replaceAll(/\s+/g, ' ').trim()]),
    )
  }
  return undefined
}

const copies = stylesheets()
  .map(({ path, text }) => ({ path, values: palette(text) }))
  .filter((copy) => copy.values !== undefined)

/**
 * formancy.ai's apps/admin/src/admin.css at e3c5967 (v0.5.0): its `:root`
 * block, every custom property, as `palette()` reads one. Read from the
 * file on 2026-10-16 with `git show e3c5967:apps/admin/src/admin.css`.
 */
const ADMIN_E3C5967 = Object.freeze({
  '--ground': '#080a12',
  '--glass': 'rgb(17 22 36 / 74%)',
  '--text': '#eef1f8',
  '--muted': '#95a0b4',
  '--edge': 'rgb(255 255 255 / 9%)',
  '--edge-strong': 'rgb(255 255 255 / 15%)',
  '--client': '#8b7bff',
  '--server': '#3fe0d5',
  '--invalid': '#ff7a8a',
  '--ok': '#4fdc8a',
  '--warn': '#ffd27a',
  '--display': "'Archivo', 'Archivo Variable', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  '--wb-ink': 'var(--text)',
  '--wb-bench': '#0b0f18',
  '--wb-panel': '#0f1422',
  '--wb-surface': '#151b2b',
  '--wb-rule': 'rgb(255 255 255 / 12%)',
  '--wb-muted': 'var(--muted)',
  '--wb-signal': 'var(--client)',
  '--wb-derived': 'var(--server)',
  '--wb-invalid': 'var(--invalid)',
  '--wb-ok': 'var(--ok)',
  '--wb-caution': '#f0b429',
})

/** Every pinned variable a copy leaves out or says otherwise, with both values. */
const unlikeAdmin = (values) =>
  Object.entries(ADMIN_E3C5967)
    .filter(([name, value]) => values?.[name] !== value)
    .map(([name, value]) => `${name}: admin.css ${value}, the copy ${values?.[name] ?? '(missing)'}`)

/** The workbench the Studio installs, whose `:root` declares the --wb-* the builder is drawn with. */
const workbench = palette(readFileSync(createRequire(join(repo, 'apps', 'studio', 'package.json')).resolve('@formancy/themes/workbench.css'), 'utf8'), null) ?? {}

/** The workbench's two font stacks, which the room leaves as the workbench sets them. */
const FONTS = new Set(['--wb-sans', '--wb-mono'])

describe("the admin's palette, in every app that copies it", () => {
  // A guard on the guard: the comparisons below are vacuous over no copy,
  // and over copies that declare nothing. The app that copies it today, and
  // the variables every copy is drawn with.
  test('is found where it is copied', () => {
    expect(copies.map(({ path }) => path)).toEqual(expect.arrayContaining(['apps/studio/src/styles/room.css']))
    for (const { path, values } of copies) {
      expect({ path, has: Object.keys(values ?? {}) }).toEqual({ path, has: expect.arrayContaining(['--ground', '--glass', '--text', '--muted', '--edge', '--client', '--server', '--invalid', '--ok', '--warn']) })
    }
  })

  // The failure this prevents is a colour moved in the copy -- a muted grey
  // darkened to fix a contrast finding here -- and the room becoming the
  // Studio's own rather than formancy.ai's. Said as every variable the copy
  // leaves out or says otherwise, both values given, so a failure names
  // what to put back, or which pin to move with admin.css.
  test('says what admin.css says at e3c5967, in every copy', () => {
    // A guard on the guard: a copy with its muted grey moved, and one with a
    // variable left out, are each found.
    const declarations = Object.entries({ ...ADMIN_E3C5967, '--muted': '#a3adbf' }).map(([name, value]) => `${name}: ${value};`)
    const moved = palette(`:root { ${MARK} ${declarations.join(' ')} }`)
    expect(unlikeAdmin(moved)).toEqual(['--muted: admin.css #95a0b4, the copy #a3adbf'])
    const { '--warn': _left, ...short } = ADMIN_E3C5967
    expect(unlikeAdmin(short)).toEqual(['--warn: admin.css #ffd27a, the copy (missing)'])
    for (const { path, values } of copies) expect({ path, unlike: unlikeAdmin(values) }).toEqual({ path, unlike: [] })
  })

  // With a second copy, the same failure between apps: one app's colour
  // moved and the same room quietly becoming two. Vacuous over one copy,
  // which the pin above covers; said as every variable on which the copies
  // differ, with each copy's value, so a failure names what to reconcile.
  test('says the same thing in every copy', () => {
    const [first, ...rest] = copies
    const names = [...new Set(copies.flatMap(({ values }) => Object.keys(values ?? {})))].sort()
    const differing = names
      .filter((name) => rest.some(({ values }) => values?.[name] !== first?.values?.[name]))
      .map((name) => `${name}: ${copies.map(({ path, values }) => `${path} ${values?.[name] ?? '(missing)'}`).join(' | ')}`)
    expect(differing, 'the copies of the palette disagree').toEqual([])
  })

  // The builder's panes are recoloured through --wb-* and nothing else. A
  // colour variable the workbench declares and the room leaves unset is
  // drawn in the workbench's light default -- a white panel in a dark room --
  // and a --wb-* the workbench does not declare recolours nothing, a typo
  // that looks like a setting.
  test("sets every colour the workbench declares, and only the workbench's", () => {
    const colours = Object.keys(workbench).filter((name) => name.startsWith('--wb-') && !FONTS.has(name))
    expect(colours.length).toBeGreaterThan(5)
    for (const { path, values } of copies) {
      const set = Object.keys(values ?? {}).filter((name) => name.startsWith('--wb-'))
      expect({ path, unset: colours.filter((name) => !set.includes(name)), unknown: set.filter((name) => !(name in workbench)) }).toEqual({ path, unset: [], unknown: [] })
    }
  })
})
