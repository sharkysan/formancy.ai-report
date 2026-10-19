import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, test } from 'vitest'

/**
 * formancy.ai's room, worn by importing the released one and never by a
 * copy (0034, formancy.ai 0178).
 *
 * Since 0.6.0, `@formancy/themes/room.css` is the admin's palette as a
 * package: the admin's custom properties at their values, and the --wb-*
 * that recolour workbench.css. The Studio and the product pages wore a
 * copy of admin.css's variables until then, held to a commit pinned here,
 * and a colour moved upstream moved nothing here. Now a copy is the
 * failure:
 *
 * - a stylesheet of this repository that declares a variable room.css
 *   declares is a second room, which the next release of the first one
 *   leaves behind. The names are read from the installed room.css, never
 *   listed, so a variable a release adds is one no stylesheet here may set
 *   from the release that adds it;
 * - so is a stylesheet that types one of the room's hues, at any alpha,
 *   rather than mixing its variable; and one that writes a colour in a
 *   function this cannot compare, hsl() or oklch(), is refused for it;
 * - an app that does not take room.css, takes it twice, or takes it
 *   before workbench.css -- both say :root, so the later wins, and the
 *   workbench's light defaults would dress the builder in the dark room,
 *   as room.css's own header warns -- is an app out of the room, and so is
 *   one that names either anywhere but in its entry, where the order is
 *   read;
 * - the installed room.css and workbench.css are held to each other: a
 *   workbench release that adds a colour room.css does not set draws a
 *   white panel in the dark room, and a --wb-* room.css sets that the
 *   workbench does not declare recolours nothing; and the text's two
 *   stacks, which the room leaves to the Studio, are the workbench's;
 * - the one colour of the room a page types outside a stylesheet, the
 *   Studio's theme-color, is the room's ground.
 *
 * What it does not see: a colour of the room typed into a script or an
 * inline style, or by its name; the room's translucent colours typed at
 * their strength, white at an alpha above all, which admin.css's rules
 * type for tints of their own; and what a build does that its sources do
 * not say. The browser gate reads the room's variables on the built page
 * for that (apps/studio/scripts/gate-page.mjs, paletteProblem).
 *
 * Which stylesheets are read is derived: every file the Studio's Vite
 * bundles as CSS and every page the repository holds outside what is
 * installed, built or measured. Each app's stylesheets are followed from
 * where its page takes them, in that order, as its build takes them.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The Studio's resolution of a package's export, from its own manifest. */
const studioRequire = createRequire(join(repo, 'apps', 'studio', 'package.json'))

/** Installed, built or measured, never written. */
const SKIP = new Set(['node_modules', 'dist', 'dist-ssr', 'coverage', 'test-results'])

/** Every file under `directory` whose name `wanted` accepts, as a path from the repository root and its text. */
function filesUnder(directory, wanted) {
  const found = []
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue
      const full = join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && wanted(entry.name)) found.push({ path: relative(repo, full).replaceAll('\\', '/'), text: readFileSync(full, 'utf8') })
    }
  }
  walk(directory)
  return found
}

/**
 * Whether `name` is a stylesheet: whatever the Studio's own Vite bundles as
 * CSS, by its own predicate -- .pcss, .scss, .less and .styl as much as
 * .css -- so a stylesheet of another kind is no way past this guard.
 */
const { isCSSRequest: isStylesheet } = await import(pathToFileURL(studioRequire.resolve('vite')).href)

/** Whether the guard reads the file `name` as a stylesheet or a page. */
export const readAsStylesheetOrPage = (name) => isStylesheet(name) || name.endsWith('.html')

/** `css` without its comments: what the browser reads. */
const uncommented = (css) => css.replaceAll(/\/\*[\s\S]*?\*\//g, '')

/** The custom properties `css` declares, anywhere in it, each by name with its value's whitespace collapsed. */
function declared(css) {
  return [...uncommented(css).matchAll(/(?<![\w-])(--[\w-]+)\s*:\s*([^;}]+)/g)].map(([, name, value]) => ({ name, value: String(value).replaceAll(/\s+/g, ' ').trim() }))
}

/** The custom properties of the first `:root` block of `css`, by name: what a palette sets. */
const rootOf = (css) => Object.fromEntries(declared(/:root\s*\{([^}]*)\}/.exec(uncommented(css))?.[1] ?? '').map(({ name, value }) => [name, value]))

/** The room the Studio installs, and the workbench it recolours. */
const ROOM = '@formancy/themes/room.css'
const WORKBENCH = '@formancy/themes/workbench.css'
const roomFile = studioRequire.resolve(ROOM)
const room = rootOf(readFileSync(roomFile, 'utf8'))
const workbench = rootOf(readFileSync(studioRequire.resolve(WORKBENCH), 'utf8'))

/**
 * The stylesheets `file` takes, in the order it takes them, `file` among
 * them: a script's imports of a stylesheet, a stylesheet's `@import`s, as
 * importsOf() reads them. A path beside the importing file is followed
 * into, and its own imports with it; a package's export is said by its
 * specifier, a leaf. Anything else -- an import by `url()`, which a
 * browser would fetch -- is refused, since what it brings could not be
 * read here.
 */
export function stylesheetsOf(file) {
  const sheet = isStylesheet(file)
  const own = sheet ? [relative(repo, file).replaceAll('\\', '/')] : []
  // A stylesheet imports stylesheets alone; a script, modules of every kind.
  const imports = importsOf(file, readFileSync(file, 'utf8')).filter((specifier) => sheet || isStylesheet(specifier))
  return [...own, ...imports.flatMap((specifier) => (/^\.\.?\//.test(specifier) ? stylesheetsOf(join(dirname(file), specifier)) : [specifier]))]
}

/**
 * What is wrong with the order of `sheets`, an app's stylesheets as
 * stylesheetsOf() gives them. The room comes after the workbench's last
 * taking, not its first: a workbench taken again after the room is the
 * :root that wins.
 */
export function roomOrderProblems(sheets) {
  const rooms = sheets.filter((sheet) => sheet === ROOM).length
  if (rooms !== 1) return [`takes ${ROOM} ${rooms === 0 ? 'nowhere' : `${String(rooms)} times`}`]
  return sheets.lastIndexOf(WORKBENCH) > sheets.indexOf(ROOM) ? [`takes ${ROOM} before ${WORKBENCH}, whose light defaults then win`] : []
}

/** What a browser reads as CSS of `file`'s text: a stylesheet whole, a page's `<style>` elements. */
const cssOf = ({ path, text }) => (path.endsWith('.html') ? [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n') : text)

/** Every declaration of a stylesheet or a page that sets a variable of `names`, said as `path: --name: value`. */
export function copiesOf(files, names) {
  return files.flatMap((file) =>
    declared(cssOf(file))
      .filter(({ name }) => names.has(name))
      .map(({ name, value }) => `${file.path}: ${name}: ${value}`),
  )
}

/**
 * The value of every declaration of `css`, nested rules' among them: each
 * stretch between `{`, `;` and `}` that holds a colon and is not followed
 * by `{`, which would make it a selector, and is not an at-rule.
 */
function valuesOf(css) {
  const parts = uncommented(css).split(/([{};])/)
  const values = []
  for (let at = 0; at < parts.length; at += 2) {
    const stretch = parts[at] ?? ''
    const colon = stretch.indexOf(':')
    if (parts[at + 1] === '{' || colon < 0 || stretch.trim().startsWith('@')) continue
    values.push(stretch.slice(colon + 1).trim())
  }
  return values
}

/** A channel of rgb(): a number, or a percentage of 255. */
const channel = (text) => (text.endsWith('%') ? (Number(text.slice(0, -1)) * 255) / 100 : Number(text))

/**
 * The red, green, blue and alpha of `literal`, a hex colour or an rgb() or
 * rgba() of numbers or percentages, comma- or space-separated; undefined for
 * anything else, a var() inside it among them.
 */
export function rgbaOf(literal) {
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(literal)?.[1]
  if (hex !== undefined) {
    const pairs = hex.length <= 4 ? [...hex].map((digit) => digit + digit) : (hex.match(/../g) ?? [])
    const [red, green, blue, alpha = 'ff'] = pairs
    return { red: parseInt(red ?? '', 16), green: parseInt(green ?? '', 16), blue: parseInt(blue ?? '', 16), alpha: parseInt(alpha, 16) / 255 }
  }
  const parts = /^rgba?\(([^()]*)\)$/i.exec(literal)?.[1]?.split(/[\s,/]+/).filter(Boolean)
  if (parts === undefined || parts.length < 3 || parts.length > 4 || parts.some((part) => !/^[\d.]+%?$/.test(part))) return undefined
  const [red, green, blue] = parts.slice(0, 3).map((part) => Math.round(channel(part)))
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3])
  return { red: red ?? NaN, green: green ?? NaN, blue: blue ?? NaN, alpha }
}

/** The colour functions whose colours rgbaOf() does not read: a colour written in one could be the room's and not be seen. */
const UNREAD = /(?<![\w-])(hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi

/**
 * The hues of `palette`, a room's :root by name: every variable whose value
 * is a colour rgbaOf() reads, opaque. A translucent one -- the room's edges
 * and rules are white at an alpha, its glass a dark at one -- is a colour
 * at its strength, and white is the paper's too; an opaque one is a colour
 * the room chose, whose tints are the room's at any strength.
 */
export function huesOf(palette) {
  return Object.entries(palette).flatMap(([name, value]) => {
    const colour = rgbaOf(value)
    return colour !== undefined && colour.alpha === 1 ? [{ name, ...colour }] : []
  })
}

/**
 * Every colour a stylesheet or a page of `files` types in a value that is a
 * hue of `hues` at any alpha, said as `path: literal, the room's --name`;
 * and every colour written in a function rgbaOf() does not read, said as
 * `path: hsl(…), a colour this cannot compare with the room's`.
 */
export function huesTyped(files, hues) {
  return files.flatMap((file) =>
    valuesOf(cssOf(file)).flatMap((value) => [
      ...[...value.matchAll(/(?<![\w-])(#[0-9a-f]{3,8}|rgba?\([^()]*\))(?![\w-])/gi)].flatMap(([literal]) => {
        const colour = rgbaOf(literal)
        const hue = colour === undefined ? undefined : hues.find((each) => each.red === colour.red && each.green === colour.green && each.blue === colour.blue)
        return hue === undefined ? [] : [`${file.path}: ${literal}, the room's ${hue.name}`]
      }),
      ...[...value.matchAll(UNREAD)].map(([, name]) => `${file.path}: ${String(name)}(…), a colour this cannot compare with the room's`),
    ]),
  )
}

/** Whether `name` is a script a build reads its imports from. */
const isScript = (name) => /\.[cm]?[jt]sx?$/.test(name)

/**
 * What `path`, a stylesheet or a script, imports, in its order, as the
 * build reads it: a stylesheet's `@import`s, and a script's imports as
 * TypeScript's own pre-processor finds them, static, dynamic and
 * require(), so one inside a comment is none.
 */
export function importsOf(path, text) {
  if (!isScript(path))
    return [...uncommented(text).matchAll(/@import\s+([^;]+);/g)].map((match) => {
      const quoted = /^(['"])([^'"]+)\1$/.exec((match[1] ?? '').trim())?.[2]
      if (quoted === undefined) throw new Error(`${path} imports ${match[0]}, which this cannot follow`)
      return quoted
    })
  return ts.preProcessFile(text, true, true).importedFiles.map((imported) => imported.fileName)
}

/**
 * Every import of one of `@formancy/themes`' stylesheets in `files` but in
 * the files `entries` names, said as `path: specifier`. Where the room and
 * the workbench are taken is where their order is read; taken anywhere
 * else -- a script the entry imports above the workbench, a stylesheet it
 * takes after the room -- the order the build gives them is another.
 */
export function themesTakenOutside(files, entries) {
  return files
    .filter(({ path }) => !entries.includes(path))
    .flatMap(({ path, text }) =>
      importsOf(path, text)
        .filter((specifier) => specifier.startsWith('@formancy/themes/') && isStylesheet(specifier))
        .map((specifier) => `${path}: ${specifier}`),
    )
}

/**
 * Where each app's page takes its stylesheets from: the Studio's script,
 * which its index.html loads, and the pages' stylesheet, which their
 * scripts/inputs.mjs inlines into the one file each page links.
 */
const ENTRIES = { studio: 'apps/studio/src/main.tsx', pages: 'apps/pages/src/pages.css' }

const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})

/** A directory holding `files`, by their paths in it. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'palette-'))
  made.push(root)
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text)
  return root
}

describe("formancy's room, imported and never copied (0034)", () => {
  // A guard on the guard: the checks below are about absence, and over a
  // room read as nothing -- an export renamed, a :root reader that found
  // no block -- they would pass forever.
  test("is read from the installed @formancy/themes, the admin's colours and the workbench's among it", () => {
    expect(Object.keys(room)).toEqual(expect.arrayContaining(['--ground', '--glass', '--text', '--muted', '--edge', '--client', '--server', '--invalid', '--ok', '--warn', '--wb-panel', '--wb-signal']))
    expect(relative(repo, roomFile).replaceAll('\\', '/')).toMatch(/^node_modules\/\.pnpm\/@formancy\+themes@[\d.]+\/node_modules\/@formancy\/themes\/room\.css$/)
  })

  // The failure this prevents is the room becoming this repository's own
  // again: a variable of the palette set in a Studio stylesheet, or in the
  // pages', or in a page's <style>, to fix a contrast finding here, and
  // formancy's next room moving everything but it. Said as each
  // declaration, with its file and value, so a failure names what to take
  // out.
  test('is declared by no stylesheet and no page of this repository', () => {
    const names = new Set(Object.keys(room))
    // A guard on the guard: a copied variable is found in a stylesheet, in
    // a page's <style>, and inside a rule, and a variable of the Studio's
    // own -- --sans, which room.css does not declare -- is not.
    const sample = [
      { path: 'a.css', text: ':root {\n  /* the room */\n  --muted: #a3adbf;\n  --sans: serif;\n}\n.x { --wb-panel:#fff }' },
      { path: 'b.html', text: '<head><style>:root { --ground: #000; }</style></head><p style="x">--client: is said here</p>' },
    ]
    expect(copiesOf(sample, names)).toEqual(['a.css: --muted: #a3adbf', 'a.css: --wb-panel: #fff', 'b.html: --ground: #000'])
    // And every kind of stylesheet the build bundles is read, not the .css
    // alone: a tint.pcss that sets --muted, imported from main.tsx, is a
    // copy that wins in the build all the same.
    const kinds = ['a.css', 'a.pcss', 'a.postcss', 'a.scss', 'a.sass', 'a.less', 'a.styl', 'a.stylus', 'a.sss', 'a.module.css', 'a.html', 'a.tsx', 'a.css.map', 'a.json']
    expect(kinds.filter(readAsStylesheetOrPage)).toEqual(['a.css', 'a.pcss', 'a.postcss', 'a.scss', 'a.sass', 'a.less', 'a.styl', 'a.stylus', 'a.sss', 'a.module.css', 'a.html'])
    const read = [...filesUnder(repo, readAsStylesheetOrPage)]
    expect(read.map(({ path }) => path)).toEqual(expect.arrayContaining(['apps/studio/src/styles/room.css', 'apps/pages/src/pages.css', 'apps/studio/index.html', 'packages/report-builder-core/report-builder.css']))
    expect(copiesOf(read, names)).toEqual([])
  })

  // The failure this prevents is a colour of the room typed rather than
  // read: a rule that tints the room's violet as rgb(139 123 255 / 15%),
  // as admin.css's rules do, stays violet when formancy's next room moves
  // --client, and the guard above, which reads names, never sees it. A
  // tint is written color-mix(in srgb, var(--client) 15%, transparent),
  // which is the same colour and moves with the room. The hues are read
  // from the installed room.css, never listed.
  test('is typed as no hue of the room in a stylesheet or a page of this repository', () => {
    const hues = huesOf(room)
    // A guard on the guard: the room's violet, teal and ground are hues, its
    // translucent edges are not, and each way a stylesheet writes a colour
    // is read -- hex of any case and length, rgb() and rgba() with commas or
    // without, in numbers or percentages -- in a rule, a nested rule and a
    // page's <style>, but not in a selector, a comment or a page's text; a
    // tint through color-mix() of the variable is no typed hue; and a
    // colour this cannot read is refused rather than passed.
    expect(hues.map(({ name }) => name)).toEqual(expect.arrayContaining(['--ground', '--client', '--server', '--wb-panel']))
    expect(hues.map(({ name }) => name)).not.toEqual(expect.arrayContaining(['--edge']))
    const of = (name) => hues.find((hue) => hue.name === name) ?? { red: NaN, green: NaN, blue: NaN }
    const hex = ({ red, green, blue }) => `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
    const [violet, teal, ground] = [of('--client'), of('--server'), of('--ground')]
    const percent = (value) => `${String((value * 100) / 255)}%`
    const sample = [
      {
        path: 'a.css',
        text: `#add { color: ${hex(violet).toUpperCase()}; }\n.x:not(#abc) { background: rgb(${String(violet.red)} ${String(violet.green)} ${String(violet.blue)} / 15%), rgba(${String(teal.red)}, ${String(teal.green)}, ${String(teal.blue)}, .09); }\n.y { .z { border-color: ${hex(teal)}cc; } outline-color: rgb(${percent(violet.red)} ${percent(violet.green)} ${percent(violet.blue)}); }\n`,
      },
      { path: 'b.css', text: `/* ${hex(violet)} said in a comment */\n.ok { background: rgb(255 255 255 / 3%); color: #fff; box-shadow: 0 0 0 1px color-mix(in srgb, var(--client) 15%, transparent); }\n` },
      { path: 'c.pcss', text: '.w { color: hsl(247 100% 74%); --tint: oklch(0.7 0.2 290); }\n' },
      { path: 'd.html', text: `<style>.v { color: ${hex(ground).toUpperCase()} }</style><p>${hex(violet)} said in the text</p>` },
    ]
    expect(huesTyped(sample, hues)).toEqual([
      `a.css: ${hex(violet).toUpperCase()}, the room's --client`,
      `a.css: rgb(${String(violet.red)} ${String(violet.green)} ${String(violet.blue)} / 15%), the room's --client`,
      `a.css: rgba(${String(teal.red)}, ${String(teal.green)}, ${String(teal.blue)}, .09), the room's --server`,
      `a.css: ${hex(teal)}cc, the room's --server`,
      `a.css: rgb(${percent(violet.red)} ${percent(violet.green)} ${percent(violet.blue)}), the room's --client`,
      "c.pcss: hsl(…), a colour this cannot compare with the room's",
      "c.pcss: oklch(…), a colour this cannot compare with the room's",
      `d.html: ${hex(ground).toUpperCase()}, the room's --ground`,
    ])
    expect(huesTyped(filesUnder(repo, readAsStylesheetOrPage), hues)).toEqual([])
  })

  // Each app's page is named here, so an app added under apps/ says how it
  // wears the room before this passes; and the Studio's entry is the
  // script its page loads, not a file this test chose.
  test("is taken by every app's page, from where the page takes its stylesheets", () => {
    const apps = readdirSync(join(repo, 'apps'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect(Object.keys(ENTRIES).sort()).toEqual(apps.sort())
    expect(readFileSync(join(repo, 'apps', 'studio', 'index.html'), 'utf8')).toContain(`<script type="module" src="/${ENTRIES.studio.slice('apps/studio/'.length)}"></script>`)
  })

  // The failure this prevents is the room loaded before the workbench,
  // whose :root then wins and draws the builder's panes light in the dark
  // room; or not at all, or twice, two rooms where one release is meant.
  // Read as each app's build takes its stylesheets, a script's imports and
  // a stylesheet's @imports in their order.
  test('is taken once by every app, after the workbench where the app takes the workbench too', () => {
    // A guard on the guard: the order is found through a stylesheet's
    // relative @import, a room before its workbench and a room taken twice
    // are each refused, and an import by url() is not followed.
    const sample = tree({
      'main.tsx': "import '@formancy/themes/workbench.css'\nimport './app.css'\n",
      'app.css': "/* @import 'said.css'; */\n@import \"@formancy/themes/room.css\";\n@import './own.css';\n",
      'own.css': '.own {}\n',
      'early.tsx': "import '@formancy/themes/room.css'\nimport '@formancy/themes/workbench.css'\n",
      'twice.css': "@import '@formancy/themes/room.css';\n@import '@formancy/themes/room.css';\n",
      'far.css': "@import url('https://example.invalid/room.css');\n",
      // The workbench taken again after the room, through a stylesheet:
      // the build's minifier merges the two :root blocks, the second
      // workbench's light --wb-panel last.
      'late.tsx': "import '@formancy/themes/workbench.css'\nimport '@formancy/themes/room.css'\nimport './extra.css'\n",
      'extra.css': "@import '@formancy/themes/workbench.css';\n",
      // The room's line inside a comment, which the build never reads.
      'commented.tsx': "import '@formancy/themes/workbench.css'\n/*\nimport '@formancy/themes/room.css'\n*/\n// import '@formancy/themes/room.css'\n",
      // A stylesheet of another kind the build bundles, followed into.
      'tinted.tsx': "import '@formancy/themes/workbench.css'\nimport '@formancy/themes/room.css'\nimport './tint.pcss'\n",
      'tint.pcss': '.tint {}\n',
    })
    const named = (sheets) => sheets.map((sheet) => (sheet.startsWith('@') ? sheet : sheet.slice(sheet.lastIndexOf('/') + 1)))
    expect(named(stylesheetsOf(join(sample, 'main.tsx')))).toEqual([WORKBENCH, 'app.css', ROOM, 'own.css'])
    expect(named(stylesheetsOf(join(sample, 'tinted.tsx')))).toEqual([WORKBENCH, ROOM, 'tint.pcss'])
    expect(roomOrderProblems(stylesheetsOf(join(sample, 'main.tsx')))).toEqual([])
    expect(roomOrderProblems(stylesheetsOf(join(sample, 'early.tsx')))).toEqual([`takes ${ROOM} before ${WORKBENCH}, whose light defaults then win`])
    expect(roomOrderProblems(stylesheetsOf(join(sample, 'late.tsx')))).toEqual([`takes ${ROOM} before ${WORKBENCH}, whose light defaults then win`])
    expect(roomOrderProblems(stylesheetsOf(join(sample, 'commented.tsx')))).toEqual([`takes ${ROOM} nowhere`])
    expect(roomOrderProblems(stylesheetsOf(join(sample, 'twice.css')))).toEqual([`takes ${ROOM} 2 times`])
    expect(roomOrderProblems([WORKBENCH])).toEqual([`takes ${ROOM} nowhere`])
    expect(() => stylesheetsOf(join(sample, 'far.css'))).toThrow(/which this cannot follow/)
    for (const [app, entry] of Object.entries(ENTRIES)) expect({ app, problems: roomOrderProblems(stylesheetsOf(join(repo, entry))) }).toEqual({ app, problems: [] })
    // The Studio takes the workbench, so the order is held there and not vacuously.
    expect(stylesheetsOf(join(repo, ENTRIES.studio))).toContain(WORKBENCH)
  })

  // The order above is read where each entry names the room and the
  // workbench. The failure this prevents is either named somewhere else,
  // where that read cannot see it: a ./theme.js the entry imports above
  // the workbench that imports the room, which the build then takes
  // first; or a stylesheet that takes the workbench again after the room.
  test("is named by no file of an app but the app's entry", () => {
    // A guard on the guard: a script's import, static or dynamic, and a
    // stylesheet's @import are found; the entry's own, a test that reads
    // the file by name, and an import inside a comment are not.
    const sample = [
      { path: 'apps/x/src/main.tsx', text: "import '@formancy/themes/workbench.css'\nimport '@formancy/themes/room.css'\nimport './theme.js'\n" },
      { path: 'apps/x/src/theme.js', text: "// import '@formancy/themes/workbench.css'\nimport '@formancy/themes/room.css'\nconst later = () => import('@formancy/themes/workbench.css')\n" },
      { path: 'apps/x/src/extra.css', text: "/* @import '@formancy/themes/room.css'; */\n@import '@formancy/themes/workbench.css';\n" },
      { path: 'apps/x/src/styles.test.tsx', text: "const sheet = exported('@formancy/themes/workbench.css')\nimport { x } from '@formancy/themes'\n" },
    ]
    expect(themesTakenOutside(sample, ['apps/x/src/main.tsx'])).toEqual(['apps/x/src/theme.js: @formancy/themes/room.css', 'apps/x/src/theme.js: @formancy/themes/workbench.css', 'apps/x/src/extra.css: @formancy/themes/workbench.css'])
    const read = filesUnder(join(repo, 'apps'), (name) => isScript(name) || isStylesheet(name))
    expect(read.map(({ path }) => path)).toEqual(expect.arrayContaining([ENTRIES.studio, ENTRIES.pages, 'apps/studio/src/studio.tsx', 'apps/studio/src/styles/room.css']))
    expect(themesTakenOutside(read, Object.values(ENTRIES))).toEqual([])
  })

  // Two apps resolving the room to two releases would be two rooms again,
  // the pages a release behind the Studio they link to. Each app resolves
  // it from its own manifest, as its build does.
  test('is one release in every app that takes it', () => {
    for (const app of Object.keys(ENTRIES)) {
      const resolved = createRequire(join(repo, 'apps', app, 'package.json')).resolve(ROOM)
      expect({ app, room: readFileSync(resolved, 'utf8') }).toEqual({ app, room: readFileSync(roomFile, 'utf8') })
    }
  })

  // The one colour of the room a page states outside a stylesheet: the
  // Studio's theme-color, the browser's own bar, which index.html says as
  // a value because a meta cannot read a variable. Typed, it is the colour
  // a move upstream would leave behind; the pages derive theirs from the
  // room's :root when they build (apps/pages/scripts/inputs.mjs).
  test("is the Studio's theme-color, the room's ground", () => {
    const themeColor = (html) => /<meta\s+name="theme-color"\s+content="([^"]*)"/.exec(html)?.[1]
    // A guard on the guard: a ground moved upstream is a colour this reads.
    expect(themeColor('<head><meta name="theme-color" content="#0b0f18" /></head>')).not.toBe(room['--ground'])
    expect(themeColor(readFileSync(join(repo, 'apps', 'studio', 'index.html'), 'utf8'))).toBe(room['--ground'])
  })

  // The builder's panes are recoloured through --wb-* and nothing else. A
  // colour variable the workbench declares and the room leaves unset is
  // drawn in the workbench's light default -- a white panel in a dark room --
  // and a --wb-* the workbench does not declare recolours nothing. Both are
  // upstream's to keep together; held here at the releases installed, so
  // a bump that parts them fails before it ships.
  test("sets every colour the workbench declares, and only the workbench's", () => {
    const FONTS = new Set(['--wb-sans', '--wb-mono'])
    const colours = Object.keys(workbench).filter((name) => name.startsWith('--wb-') && !FONTS.has(name))
    expect(colours.length).toBeGreaterThan(5)
    const set = Object.keys(room).filter((name) => name.startsWith('--wb-'))
    expect({ unset: colours.filter((name) => !set.includes(name)), unknown: set.filter((name) => !(name in workbench)) }).toEqual({ unset: [], unknown: [] })
  })

  // The room leaves the text's two faces to the page. The Studio's room
  // names them as --sans and --mono, at the stacks the admin reads from
  // the workbench as --wb-sans and --wb-mono, because the pages load no
  // workbench. The failure this prevents is the two parting: a workbench
  // release that moves a stack, and the Studio's text and the builder's
  // set in two faces in one room.
  test("leaves the text's stacks to the Studio, at the workbench's", () => {
    const own = rootOf(readFileSync(join(repo, 'apps', 'studio', 'src', 'styles', 'room.css'), 'utf8'))
    // A guard on the guard: both stacks are read, on both sides.
    expect([own['--sans'], own['--mono'], workbench['--wb-sans'], workbench['--wb-mono']].every((stack) => typeof stack === 'string' && stack.length > 0)).toBe(true)
    expect({ sans: own['--sans'], mono: own['--mono'] }).toEqual({ sans: workbench['--wb-sans'], mono: workbench['--wb-mono'] })
  })
})
