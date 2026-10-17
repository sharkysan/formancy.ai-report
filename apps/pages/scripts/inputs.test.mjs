import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import { familiesOf } from '../../../scripts/web-fonts.mjs'
import { bundleStylesheet, imageSize, licenceTermsOf, readInputs, releaseOf } from './inputs.mjs'

/**
 * What the pages are built from, read from the repository rather than typed
 * into them (CLAUDE.md, "Derive it"): the release and its date from the
 * changelog, the licence's terms from LICENSE.md, the address from the
 * Worker's route, the faces from the Studio's fonts.css, the pictures' sizes
 * from the files, and the stylesheet from the Studio's room. Each reader
 * refuses what it cannot read, so a document that changed shape fails the
 * build instead of putting a guess on a page.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})

describe('the release the pages name', () => {
  // A version typed into a page outlives the next release; read from the
  // changelog's newest version heading, it moves with it. Unreleased is no
  // release, and a changelog without one has nothing to say.
  test("is the changelog's newest version heading, never Unreleased", () => {
    const changelog = '# Changelog\n\n## Unreleased\n\n- next\n\n## 0.2.0 — 2026-11-02\n\n- two\n\n## 0.1.0 — 2026-10-16\n'
    expect(releaseOf(changelog)).toEqual({ version: '0.2.0', date: '2026-11-02', anchor: '020--2026-11-02' })
    expect(() => releaseOf('# Changelog\n\n## Unreleased\n')).toThrow(/no released version/)
  })
})

describe("the licence's terms the pages state", () => {
  // The pages translate the table, row by row; read from LICENSE.md, a row
  // changed there is a row the pages no longer have words for, and the
  // site refuses to render rather than state the old terms.
  test("are LICENSE.md's table, row by row", () => {
    expect(licenceTermsOf(readFileSync(join(repo, 'LICENSE.md'), 'utf8'))).toEqual([
      ['Read the source and fork the repository', 'Free'],
      ['Evaluate, develop and test — including in companies', 'Free'],
      ['Run in production, internally or customer-facing', 'Paid licence'],
      ['Redistribute inside another software product', 'Separate commercial agreement'],
      ['Customer data, report templates and generated documents', "Remain the customer's"],
    ])
    expect(() => licenceTermsOf('# Licence\n\nNo table here.\n')).toThrow(/The terms in one table/)
  })
})

describe('the faces the pages serve (0023)', () => {
  // The pages wear the Studio's faces, at its weights, from the Studio's
  // fonts.css, so a face the Studio changes changes here; and they serve
  // them from their own copies, so no page asks another site for one. Each
  // font file the stylesheet names is copied out of the pages' own
  // Fontsource package and named beside the stylesheet; none is left named
  // where the package keeps it, which under /report/site/ is nowhere.
  test("are the Studio's fonts.css's, copied from the pages' own packages", () => {
    const { fonts, stylesheet } = readInputs(repo)
    expect(fonts.length).toBeGreaterThan(0)
    for (const font of fonts) {
      expect(font.from).toMatch(/^apps\/pages\/node_modules\/@fontsource(-variable)?\/[\w-]+\/files\/[\w-]+\.woff2?$/)
      expect({ font: font.href, named: stylesheet.includes(`url(${font.href})`) }).toEqual({ font: font.href, named: true })
    }
    expect(stylesheet).not.toMatch(/https?:|url\(\.\/files\//)
    expect(familiesOf(stylesheet).sort()).toEqual(['Archivo Variable', 'IBM Plex Mono', 'IBM Plex Sans'])
  })
})

describe("a picture's size", () => {
  // Width and height on an <img> keep the page from jumping as it loads;
  // typed, they would describe the picture before it was taken again.
  test('is read from the PNG or WebP it is, and refused for anything else', () => {
    expect(imageSize(readFileSync(join(repo, 'docs', 'images', 'starter-quotation.png')))).toEqual({ width: 745, height: 1053 })
    expect(imageSize(readFileSync(join(repo, 'docs', 'images', 'readme', 'studio-react.webp')))).toEqual({ width: 4200, height: 1800 })
    expect(() => imageSize(new TextEncoder().encode('GIF89a and so on'))).toThrow(/neither a PNG nor a WebP/)
  })
})

describe("the pages' stylesheet", () => {
  /** A directory holding `files`, each path with its text. */
  function tree(files) {
    const directory = mkdtempSync(join(tmpdir(), 'formancy-report-pages-'))
    made.push(directory)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true })
      writeFileSync(join(directory, path), text)
    }
    return directory
  }

  // The room is imported from the Studio, never copied (0021): its
  // variables reach the pages through the import, which the build inlines
  // as Vite inlines the Studio's. Comments go; every file read is said, so
  // turbo can be told to build again when one changes.
  test('inlines every relative import, in order, without comments, and says which files it read', () => {
    const root = tree({
      'pages/src/pages.css': "/* the pages */\n@import '../../studio/room.css';\n.page { color: var(--text); }\n",
      'studio/room.css': ":root {\n  /* the room */\n  --text: #eef1f8;\n}\n@import './more.css';\n",
      'studio/more.css': '.skip { top: 0; }\n',
    })
    const read = []
    const { css, fonts } = bundleStylesheet(join(root, 'pages', 'src', 'pages.css'), { read: (file) => read.push(file) })
    expect(css).toBe(':root {\n  --text: #eef1f8;\n}\n.skip { top: 0; }\n.page { color: var(--text); }\n')
    expect(fonts).toEqual([])
    expect(read.map((file) => file.slice(root.length + 1).replaceAll('\\', '/'))).toEqual(['pages/src/pages.css', 'studio/room.css', 'studio/more.css'])
  })

  /** A Fontsource-shaped package in `modules`: its manifest, and its stylesheet naming a WOFF2 and a WOFF of one subset, both shipped. */
  const face = (modules, name, file) => ({
    [`${modules}/${name}/package.json`]: JSON.stringify({ name, version: '5.3.0', license: 'OFL-1.1' }),
    [`${modules}/${name}/400.css`]: `/* ${file} */\n@font-face {\n  font-family: 'Face';\n  src: url(./files/${file}.woff2) format('woff2'), url(./files/${file}.woff) format('woff');\n}\n`,
    [`${modules}/${name}/files/${file}.woff2`]: 'woff2',
    [`${modules}/${name}/files/${file}.woff`]: 'woff',
  })

  // The faces arrive as the Studio's do (0023): the Studio's fonts.css
  // imports Fontsource's stylesheets by package. Inlined, each url() is
  // rewritten to the copy beside the pages' stylesheet, and the file it
  // names is said, to be copied there; left as the package wrote it,
  // ./files/ under /report/site/ is nothing. The package is the pages' own
  // dependency, found in their node_modules and never the Studio's, so
  // the pages' package.json says what they serve.
  test("inlines a package's stylesheet from the pages' own packages, and names each font it names beside the stylesheet", () => {
    const root = tree({
      'pages/src/pages.css': "@import '../../studio/fonts.css';\n.page { font-family: 'Face'; }\n",
      'studio/fonts.css': "/* the faces */\n@import 'face/400.css';\n",
      ...face('pages/node_modules', 'face', 'face-latin-400-normal'),
      ...face('studio/node_modules', 'face', 'the-studios-copy'),
    })
    const read = []
    const { css, fonts } = bundleStylesheet(join(root, 'pages', 'src', 'pages.css'), { read: (file) => read.push(file), packages: join(root, 'pages', 'node_modules') })
    expect(css).toBe("@font-face {\n  font-family: 'Face';\n  src: url(fonts/face-latin-400-normal.woff2) format('woff2'), url(fonts/face-latin-400-normal.woff) format('woff');\n}\n.page { font-family: 'Face'; }\n")
    const relative = (file) => file.slice(root.length + 1).replaceAll('\\', '/')
    expect(fonts.map((font) => ({ href: font.href, from: relative(font.from) }))).toEqual([
      { href: 'fonts/face-latin-400-normal.woff2', from: 'pages/node_modules/face/files/face-latin-400-normal.woff2' },
      { href: 'fonts/face-latin-400-normal.woff', from: 'pages/node_modules/face/files/face-latin-400-normal.woff' },
    ])
    expect(read.map(relative)).toEqual(['pages/src/pages.css', 'studio/fonts.css', 'pages/node_modules/face/400.css'])
  })

  // An import by URL would be fetched by the browser, under /report/; a
  // package the pages do not depend on is a face served from nobody's
  // dependency; a url() naming a file its package does not ship is a face
  // that never loads; and two packages shipping one file name would be
  // copied over each other. Each is refused, naming it.
  test('refuses an import it cannot inline, a package that is not the pages’, a font that is not there, and two fonts of one name', () => {
    const root = tree({
      'a.css': "@import url('https://example.com/b.css');\n",
      'b.css': "@import 'missing/400.css';\n",
      'c.css': "@import 'gone/400.css';\n",
      'd.css': "@import 'face/400.css';\n@import 'twin/400.css';\n",
      'node_modules/gone/package.json': JSON.stringify({ name: 'gone', version: '1.0.0' }),
      'node_modules/gone/400.css': "@font-face { font-family: 'Gone'; src: url(./files/gone.woff2); }\n",
      ...face('node_modules', 'face', 'same'),
      ...face('node_modules', 'twin', 'same'),
    })
    const packages = join(root, 'node_modules')
    expect(() => bundleStylesheet(join(root, 'a.css'), { packages })).toThrow(/an @import it does not inline/)
    expect(() => bundleStylesheet(join(root, 'b.css'), { packages })).toThrow(/imports missing\/400\.css, and missing is not a package the pages depend on/)
    expect(() => bundleStylesheet(join(root, 'c.css'), { packages })).toThrow(/names \.\/files\/gone\.woff2, which gone does not ship/)
    expect(() => bundleStylesheet(join(root, 'd.css'), { packages })).toThrow(/same\.woff2 is shipped by face and by twin/)
  })
})

describe('the inputs as the repository holds them', () => {
  // The whole read, once, against the files committed: what the pages are
  // built from today.
  test('are read whole, from the files the build is told to watch', () => {
    const inputs = readInputs(repo, { pictures: ['starter-quotation.png'] })
    expect(inputs.site).toBe('https://formancy.ai/report/')
    expect(inputs.repository).toBe('https://github.com/sharkysan/formancy.ai-report')
    expect(inputs.packages).toContain('@formancy/report-builder-react')
    expect(inputs.packages).not.toContain('@formancy/report-corpus')
    expect(inputs.licence).toMatchObject({ version: '1', address: 'info@formancy.ai' })
    expect(inputs.licence.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(inputs.ground).toBe('#080a12')
    expect(inputs.stylesheet).toContain('--ground: #080a12;')
    expect(inputs.pictures).toEqual([
      expect.objectContaining({ name: 'starter-quotation.png', from: 'docs/images/starter-quotation.png', width: 745, height: 1053, lines: expect.arrayContaining(["Total CHF 3'143.00"]) }),
    ])
    expect(inputs.read).toEqual(expect.arrayContaining(['CHANGELOG.md', 'LICENSE.md', 'apps/studio/wrangler.json', 'apps/studio/src/styles/room.css', 'apps/studio/src/styles/fonts.css', 'docs/images/pictures.json', 'docs/images/starter-quotation.png']))
    expect(inputs.notices).toContain('@fontsource/ibm-plex-sans 5.3.0')
  })

  // A picture the site names and the repository does not hold stops the
  // build, rather than a page with a broken image.
  test('refuses a picture the repository does not hold', () => {
    expect(() => readInputs(repo, { pictures: ['starter-missing.png'] })).toThrow(/starter-missing\.png/)
  })
})

describe("turbo's cache of the pages' build", () => {
  // Turbo replays a cached dist/ when nothing it hashes for the build
  // changed, and by default it hashes the package's own files alone. The
  // build reads the changelog, the licence, the Studio's room and more,
  // and runs the repository's scripts that read them: an edit to one of
  // those alone would deploy pages that say what they said before. Every
  // file the reader reads, and every script of the repository it imports,
  // is among the inputs turbo resolves for the build (apps/pages/turbo.json),
  // asked of turbo itself.
  //
  // A timeout catches a hang; it does not time anything. Measured on
  // 2026-10-17 on a Windows 11 workstation (i9-10900K): the case took 0.5
  // and 0.54 s, turbo's dry run with it; 60 s is that a hundred times over.
  test('hashes every file the build reads and every repository script it runs', { timeout: 60_000 }, () => {
    const dry = spawnSync('pnpm', ['exec', 'turbo', 'run', 'build', '--dry=json', '--filter=@formancy/report-pages'], { cwd: repo, encoding: 'utf8', shell: process.platform === 'win32' })
    expect(dry.status).toBe(0)
    const task = JSON.parse(dry.stdout).tasks.find((each) => each.directory.replaceAll('\\', '/') === 'apps/pages' && each.task === 'build')
    const hashed = new Set(Object.keys(task?.inputs ?? {}).map((path) => posix.join('apps/pages', path)))
    const { read } = readInputs(repo, { pictures: ['starter-quotation.png', 'readme/studio-react.webp'] })
    const source = readFileSync(join(repo, 'apps', 'pages', 'scripts', 'inputs.mjs'), 'utf8')
    const scripts = [...source.matchAll(/^import [^\n]* from '\.\.\/\.\.\/\.\.\/(scripts\/[\w-]+\.mjs)'$/gm)].map((match) => match[1])
    expect(scripts.length).toBeGreaterThan(0)
    const outside = [...read, ...scripts].filter((path) => !path.startsWith('apps/pages/'))
    expect(outside.length).toBeGreaterThan(5)
    expect(outside.filter((path) => !hashed.has(path))).toEqual([])
    // The faces' stylesheets and files are read from the pages' own
    // node_modules, which turbo does not hash as inputs: it folds the
    // pages' dependencies, as the lockfile resolves them, into the task's
    // hash instead (`hashOfExternalDependencies`). So each such file must
    // be a package the pages' package.json names.
    expect(task?.hashOfExternalDependencies).toMatch(/^[0-9a-f]+$/)
    const manifest = JSON.parse(readFileSync(join(repo, 'apps', 'pages', 'package.json'), 'utf8'))
    const installed = read.filter((path) => path.startsWith('apps/pages/node_modules/'))
    expect(installed.length).toBeGreaterThan(0)
    const packageOf = (path) => /^apps\/pages\/node_modules\/((?:@[\w-]+\/)?[\w-]+)\//.exec(path)?.[1]
    expect(installed.filter((path) => !Object.hasOwn(manifest.dependencies ?? {}, packageOf(path) ?? ''))).toEqual([])
  })
})
