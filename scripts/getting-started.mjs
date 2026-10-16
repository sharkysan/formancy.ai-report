/**
 * docs/getting-started.md, read as the install gate and the repository's
 * guard read it: one reading, so the two cannot disagree about which blocks
 * there are or where each goes (0015).
 *
 * Every fenced block names its language. A block of code -- TypeScript or
 * JavaScript -- is handed to the gate by its info string, and the gate
 * compiles TypeScript only:
 *
 *   ```ts guide=node                    one host's module, its entry by default
 *   ```ts guide=react,angular file=editor.ts   one file in each host named
 *   ```text guide=node                  what that host's program prints
 *   ```sh guide=node,react              npm install lines for those hosts
 *
 * A host is a kind of application the gate builds from the guide, each the
 * `guide` of a host in install-hosts.mjs. Blocks of one host and one file are
 * one module, in the order the guide shows them, which is the order a reader
 * types them in. A block the gate would not run is refused, with its line,
 * rather than skipped: a guide whose code nothing compiles drifts silently.
 */

import { lexer } from 'marked'

/** Languages that are code a reader copies and runs. */
const CODE = new Set(['ts', 'tsx', 'typescript', 'mts', 'cts', 'js', 'jsx', 'javascript', 'mjs', 'cjs', 'node'])

/**
 * The one language a block may be written in without a guide= tag: a tool's
 * own configuration file a reader edits, such as angular.json, which no host
 * the gate builds reads. Everything else names its host, or is refused --
 * an untagged shell block could tell a reader to install what the gate never
 * installs, and an untagged output block show what nothing compares.
 */
const UNTAGGED = new Set(['json'])

/** Those the gate compiles: TypeScript, with JSX or without. */
const COMPILED = new Set(['ts', 'tsx'])

/** What an info string may say after its language. */
const ATTRIBUTES = new Set(['guide', 'file'])

/** A file the gate writes into a host's `guide/` directory: a plain name, never a path. */
const FILE = /^[a-z][a-z0-9-]*\.(ts|tsx)$/

/**
 * `npm install` and the packages it names, each with a version or without,
 * `--save-dev` before them for the tools a project builds with; and the one
 * setting a project needs, `npm pkg set type=module`. Nothing else is a line
 * of an install block.
 */
const INSTALL = /^npm install(?: +(--save-dev))?((?: +[@a-z0-9][\w.@~^/-]*)+)$/
const SETTING = /^npm pkg set (type)=(module)$/

/**
 * Every block of code in `markdown`, in order, read as GitHub reads the
 * guide: by marked's GitHub-flavoured lexer, so a fence nested in a list item
 * or a quote is one, and one inside an HTML comment, which no reader sees, is
 * not. Each gives the line its fence opens on (from 1), its language, the
 * attributes its info string gives (split on any whitespace, a tab
 * included), its code, and whether it was indented rather than fenced --
 * which readGuide refuses, since an indented block has no info string to
 * tag it with.
 */
export function fencedBlocks(markdown) {
  const source = markdown.replaceAll('\r\n', '\n')
  const lines = source.split('\n')
  const blocks = []
  let offset = 0
  // The paragraph a block follows, which says what the block is and which
  // file it goes in: a reader of the rendered guide sees no info string.
  let lead = ''
  for (const token of lexer(source, { gfm: true })) {
    if (token.type === 'paragraph') lead = token.text
    const first = source.slice(0, offset).split('\n').length - 1
    let cursor = first
    for (const code of codeTokens(token)) {
      const opening = code.raw.replace(/^\n+/, '').split('\n')[0].trim()
      // Where the token opens in the guide: the next line that, its list
      // indent and quote markers taken off, is the token's first line.
      let at = cursor
      while (at < lines.length && lines[at].replace(/^(?:\s*>)*\s*/, '').trim() !== opening.replace(/^(?:\s*>)*\s*/, '')) at += 1
      if (at === lines.length) at = cursor
      cursor = at + 1
      const [language = '', ...rest] = (code.lang ?? '').trim().split(/\s+/).filter((word) => word !== '')
      const attributes = new Map(rest.map((word) => [word.split('=')[0], word.includes('=') ? word.slice(word.indexOf('=') + 1) : '']))
      blocks.push({ line: at + 1, language, attributes, words: rest, code: code.text, indented: code.codeBlockStyle === 'indented', lead })
    }
    offset += token.raw.length
  }
  return blocks
}

/** The code tokens in `token` and everything nested in it -- list items, quotes -- in document order. */
function codeTokens(token) {
  if (token.type === 'code') return [token]
  const nested = [...(token.items ?? []), ...(token.tokens ?? [])]
  return nested.flatMap((child) => codeTokens(child))
}

/**
 * The guide as the gate builds it, for `hosts` -- each host's guide, by its
 * kind: `{ kind, entry, prints, bundled }` -- as a map from kind to what it
 * gets: `files`, each module's code by file name; `output`, the lines its
 * program is shown printing, or null; `installs`, every package its install
 * lines name, with the version given or null; and `blocks`, the line every
 * block it was given opens on. Throws, naming the line, on any block the
 * gate would not run, and on a host given no code.
 */
export function readGuide(markdown, hosts) {
  const known = new Map(hosts.map((host) => [host.kind, host]))
  const read = new Map(hosts.map((host) => [host.kind, { files: new Map(), output: null, installs: [], settings: {}, blocks: [] }]))
  for (const block of fencedBlocks(markdown)) {
    const where = `docs/getting-started.md line ${String(block.line)}`
    if (block.indented) throw new Error(`${where}: an indented code block, which has no info string to say whether it is code the gate should run; fence it and tag it`)
    const language = block.language.toLowerCase()
    if (language === '') throw new Error(`${where}: a fence with no language, so nothing can say whether it is code the gate should run`)
    const unknown = block.words.filter((word) => !ATTRIBUTES.has(word.split('=')[0]) || !word.includes('='))
    if (unknown.length > 0) throw new Error(`${where}: ${unknown.join(' ')} is not something a block's info string says here; it says guide= and file=`)
    const tag = block.attributes.get('guide')
    if (tag === undefined) {
      if (CODE.has(language)) throw new Error(`${where}: a ${block.language} block with no guide= tag, which the install gate would never compile or run`)
      if (!UNTAGGED.has(language)) throw new Error(`${where}: a ${block.language} block with no guide= tag; only ${[...UNTAGGED].join(', ')} may go untagged, so an install line or an output nothing checks cannot slip in`)
      if (block.attributes.has('file')) throw new Error(`${where}: file= without guide= names a file in no host`)
      continue
    }
    const kinds = tag.split(',')
    for (const kind of kinds) {
      if (!known.has(kind)) throw new Error(`${where}: guide=${kind} is no host the install gate builds; it builds ${[...known.keys()].join(', ')}`)
    }
    if (new Set(kinds).size !== kinds.length) throw new Error(`${where}: guide=${tag} names a host twice`)
    for (const kind of kinds) read.get(kind).blocks.push(block.line)

    if (COMPILED.has(language)) {
      for (const kind of kinds) {
        const host = known.get(kind)
        const file = block.attributes.get('file') ?? host.entry
        if (!FILE.test(file)) throw new Error(`${where}: file=${file} is not a plain .ts or .tsx name`)
        if (!file.endsWith(`.${language}`)) throw new Error(`${where}: a ${language} block in ${file}, which ${kind} compiles as ${file.slice(file.lastIndexOf('.') + 1)}`)
        if (file !== host.entry && !host.bundled) throw new Error(`${where}: ${kind} runs one module, ${host.entry}, and bundles none, so ${file} would be compiled and never run`)
        const files = read.get(kind).files
        const stem = file.slice(0, file.lastIndexOf('.'))
        const clash = [...files.keys()].find((other) => other !== file && other.slice(0, other.lastIndexOf('.')) === stem)
        if (clash !== undefined) throw new Error(`${where}: ${file} beside ${clash} in ${kind}, which one import of ./${stem}.js could not tell apart`)
        files.set(file, files.has(file) ? `${files.get(file)}\n\n${block.code}` : block.code)
      }
    } else if (CODE.has(language)) {
      throw new Error(`${where}: a ${block.language} block; the install gate compiles TypeScript, so write it as ts or tsx`)
    } else if (language === 'text') {
      if (block.attributes.has('file')) throw new Error(`${where}: an output block names no file`)
      for (const kind of kinds) {
        if (!known.get(kind).prints) throw new Error(`${where}: ${kind}'s run compares no output, so an output block for it is a claim nothing checks`)
        const entry = read.get(kind)
        entry.output = entry.output === null ? block.code : `${entry.output}\n${block.code}`
      }
    } else if (language === 'sh') {
      if (block.attributes.has('file')) throw new Error(`${where}: an install line names no file`)
      for (const line of block.code.split('\n').map((text) => text.trim()).filter((text) => text !== '')) {
        const setting = SETTING.exec(line)
        const installs = setting === null ? installLine(line, where) : []
        for (const kind of kinds) {
          if (setting !== null) read.get(kind).settings[setting[1]] = setting[2]
          read.get(kind).installs.push(...installs)
        }
      }
    } else {
      throw new Error(`${where}: guide= on a ${block.language} block, which the gate neither compiles, compares nor installs`)
    }
  }
  for (const [kind, entry] of read) {
    if (!entry.files.has(known.get(kind).entry)) throw new Error(`docs/getting-started.md gives ${kind} no ${known.get(kind).entry}, the module the install gate runs for it`)
  }
  return read
}

/**
 * The packages an `npm install` line names, each `{ name, version, dev }`:
 * the version null when the line gives none, `dev` for a tool installed
 * with --save-dev.
 */
function installLine(line, where) {
  const match = INSTALL.exec(line)
  if (match === null) throw new Error(`${where}: ${line} is not an npm install line or npm pkg set type=module, which is all an install block holds`)
  const dev = match[1] === '--save-dev'
  return match[2]
    .trim()
    .split(/ +/)
    .map((spec) => {
      const at = spec.indexOf('@', 1)
      return at === -1 ? { name: spec, version: null, dev } : { name: spec.slice(0, at), version: spec.slice(at + 1), dev }
    })
}

/**
 * The package each import of `code` names -- `react-dom` for
 * `react-dom/client`, `@formancy/report-core` for itself -- and `node:` for
 * a Node built-in; relative imports are the guide's own modules.
 */
export function importedPackages(code) {
  const specifiers = [...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1] ?? match[2] ?? match[3])
  const packages = specifiers
    .filter((specifier) => !specifier.startsWith('.'))
    .map((specifier) => {
      if (specifier.startsWith('node:')) return 'node:'
      const parts = specifier.split('/')
      return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
    })
  return [...new Set(packages)].sort()
}
