/**
 * What the install gate installs, and where.
 *
 * The server has a Node host of its own, holding it and what it declares
 * and nothing else, beside the Node program's, which holds every other
 * package that is no builder (0046); the client is installed beside it,
 * to be asked of it, and in a browser's host of its own (0049).
 *
 * Each kind of host gets a project of its own, holding what that host would
 * hold and nothing else, because one shared project lets a package resolve
 * what its own host would not have. A React host has React and React's
 * types but no Node types and no Node package, so a builder declaration
 * that references Node's types, or an import of a package the builder never
 * declared, fails in the React project. In a project shared with the Node
 * consumer, both would resolve and pass. Each builder is installed twice:
 * at the newest release its peer range admits, which is what npm picks, and
 * at the oldest. At the newest alone, a builder that uses an API newer than
 * its floor, or that carries its own React, passes.
 *
 * Everything here is derived from the packed manifests. A peer range is
 * read for both ends, and the packages a builder declares, transitively,
 * are what its project installs.
 *
 * Three hosts also build what docs/getting-started.md builds (0015): the
 * Node host its program, the Angular host its page, and a React page of its
 * own, `react-app`, which previews in the browser and so installs the
 * renderer beside the builder. The guide's blocks are written into each
 * host's `guide/` directory by getting-started.mjs's reading, type-checked
 * with the rest of the host's code, run by the host's `guide` runner, and,
 * for a page, bundled for a browser every one.
 */
import { readFileSync } from 'node:fs'

/**
 * The workbench release the builders are dressed with: the one the Studio
 * declares, whose browser gate and pictures show the two stylesheets
 * together. The guide's pages install it, as the guide tells a host to.
 */
const THEMES = JSON.parse(readFileSync(new URL('../apps/studio/package.json', import.meta.url), 'utf8')).dependencies?.['@formancy/themes']
if (typeof THEMES !== 'string') throw new Error('apps/studio/package.json declares no @formancy/themes, so no workbench release is the one to install')

/** The TypeScript the workspace pins; a consumer on another major is its own question. */
const TYPESCRIPT = '~6.0.3'
const TSX = '^4.20.3'
/** The esbuild tsx brings, so the two are one copy. */
const ESBUILD = '^0.28.0'

/**
 * What a project's code is type-checked with. skipLibCheck is OFF in every
 * one, deliberately: skipping library checks is what lets a broken
 * declaration file reach a consumer unnoticed, and the published
 * declaration files are precisely what is on trial here.
 */
const STRICT = { strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, skipLibCheck: false }
/** A browser host's code: the DOM, and no Node. */
const BROWSER = { lib: ['ES2023', 'DOM', 'DOM.Iterable'], types: [] }

/** A package that follows a peer, released with it at the same version: Angular's. */
const together = (spec) => spec
/** DefinitelyTyped publishes a release line per minor with patches of its own: at the floor, the floor's line. */
const typesOf = (spec, at) => (at === 'floor' ? `~${spec.split('.').slice(0, 2).join('.')}.0` : spec)

/** React's types, on React's own release line at either end. */
const REACT_TYPES = { '@types/react': ['react', typesOf], '@types/react-dom': ['react-dom', typesOf] }

/**
 * The hosts, in the order the gate reports them. `node` takes every
 * package that is no host's builder and no host `serves`. Each builder's host lists the peers
 * its builder must declare, what follows them, and what it runs, in order;
 * `with` names packages a host installs beside its builder or what it
 * serves, each with what it declares. A host is a browser's -- checked
 * against the DOM's types and none of Node's, and refused @types/node --
 * when it has a builder or says `browser`. A command whose program is not
 * `node` is a binary installed in the project.
 *
 * `guide` is the part of docs/getting-started.md a host builds: the `kind`
 * a block's `guide=` names, the `entry` module its blocks go to unless they
 * name a file, the `runner` that runs that entry, whether the runner
 * compares what it `prints` with the guide's output blocks, and whether
 * every module is `bundled` for a browser.
 */
export const HOSTS = {
  // A Node program with no DOM and no framework: what it imports -- every
  // package but the builders -- must need no DOM type, and only Node's.
  node: {
    consumer: 'consume.ts',
    guide: { kind: 'node', entry: 'quotation.ts', runner: 'guide-node.ts', prints: true, bundled: false },
    tools: { '@types/node': '^22.10.0', typescript: TYPESCRIPT, tsx: TSX },
    tsconfig: {
      file: 'tsconfig.consume.json',
      content: {
        compilerOptions: { ...STRICT, target: 'ES2023', module: 'NodeNext', moduleResolution: 'nodenext', lib: ['ES2023'], types: ['node'], noEmit: true },
        include: ['consume.ts', 'guide-node.ts', 'guide'],
      },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.consume.json'] },
      { name: 'run', command: ['tsx', '--tsconfig', 'tsconfig.consume.json', 'consume.ts'] },
      { name: 'guide: run', command: ['tsx', '--tsconfig', 'tsconfig.consume.json', 'guide-node.ts'] },
    ],
  },
  // A host that runs Report's server in its own process (0046): Node's
  // types, the server and what it declares, and nothing else, so a server
  // that imported a package it never declared -- the runtime, the renderer
  // -- fails here, where the Node host, which installs them all, would pass
  // it. `serves` is the package it is apart for, as a builder's host is for
  // its builder. The client is beside it, with what it declares, and
  // server.ts asks the server through it over a socket (0049).
  server: {
    serves: '@formancy/report-server',
    with: ['@formancy/report-client'],
    consumer: 'server.ts',
    tools: { '@types/node': '^22.10.0', typescript: TYPESCRIPT, tsx: TSX },
    tsconfig: {
      file: 'tsconfig.server.json',
      content: {
        compilerOptions: { ...STRICT, target: 'ES2023', module: 'NodeNext', moduleResolution: 'nodenext', lib: ['ES2023'], types: ['node'], noEmit: true },
        include: ['server.ts'],
      },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.server.json'] },
      { name: 'run', command: ['tsx', '--tsconfig', 'tsconfig.server.json', 'server.ts'] },
    ],
  },
  // A page that keeps a report's draft on Report's server (0049): the
  // client and what it declares, the DOM's types and none of Node's, and
  // the module resolution a bundler has, so a client that imported a
  // `node:` module, or whose declarations named a Node type, fails here,
  // where the server's host, which has Node's types, would pass it. What
  // it exports is bundled for a browser, as a builder's is; it is run
  // against the server in the server's host.
  client: {
    serves: '@formancy/report-client',
    browser: true,
    consumer: 'client.ts',
    tools: { typescript: TYPESCRIPT, esbuild: ESBUILD },
    tsconfig: {
      file: 'tsconfig.client.json',
      content: { compilerOptions: { ...STRICT, ...BROWSER, target: 'ES2023', module: 'preserve', moduleResolution: 'bundler', noEmit: true }, include: ['client.ts'] },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.client.json'] },
      { name: 'browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--exports', '@formancy/report-client'] },
    ],
  },
  react: {
    builder: '@formancy/report-builder-react',
    consumer: 'react.tsx',
    peers: ['react', 'react-dom'],
    follows: REACT_TYPES,
    tools: { typescript: TYPESCRIPT, tsx: TSX, esbuild: ESBUILD },
    // Its own tsconfig for tsx too: without `jsx: react-jsx`, tsx compiles
    // react.tsx to React.createElement, and it dies on "React is not defined".
    tsconfig: {
      file: 'tsconfig.react.json',
      content: { compilerOptions: { ...STRICT, ...BROWSER, target: 'ES2023', module: 'NodeNext', moduleResolution: 'nodenext', jsx: 'react-jsx', noEmit: true }, include: ['react.tsx'] },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.react.json'] },
      // Development, where React says what it objects to; production, which
      // is what a host's bundler ships: a builder built with React's
      // development JSX runs in the one and throws in the other.
      { name: 'run, development', command: ['tsx', '--tsconfig', 'tsconfig.react.json', 'react.tsx'], env: { NODE_ENV: 'development' } },
      { name: 'run, production', command: ['tsx', '--tsconfig', 'tsconfig.react.json', 'react.tsx'], env: { NODE_ENV: 'production' } },
      { name: 'browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--exports', '@formancy/report-builder-react'] },
    ],
  },
  // The guide's React page: the builder, and the renderer's browser entry
  // its preview prints with, each with what it declares, and the
  // workbench's stylesheet -- what the guide's install lines name -- beside
  // React. Apart from `react`, which holds only what the builder declares,
  // so that a builder importing the renderer without declaring it still
  // fails there. A browser's code: the DOM's types, no Node's, and the
  // module resolution a bundler has; `css.d.ts` says of a stylesheet
  // import what a bundler's client types say.
  'react-app': {
    builder: '@formancy/report-builder-react',
    with: ['@formancy/report-render-pdf'],
    consumer: 'guide-react.tsx',
    guide: { kind: 'react', entry: 'report-page.tsx', runner: 'guide-react.tsx', prints: false, bundled: true },
    peers: ['react', 'react-dom'],
    follows: REACT_TYPES,
    fixed: { '@formancy/themes': THEMES },
    tools: { typescript: TYPESCRIPT, tsx: TSX, esbuild: ESBUILD },
    tsconfig: {
      file: 'tsconfig.react-app.json',
      content: {
        compilerOptions: { ...STRICT, ...BROWSER, target: 'ES2023', module: 'preserve', moduleResolution: 'bundler', jsx: 'react-jsx', noEmit: true },
        include: ['guide-react.tsx', 'guide', 'css.d.ts'],
      },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.react-app.json'] },
      // Development, where React says what it objects to.
      { name: 'guide: run', command: ['tsx', '--tsconfig', 'tsconfig.react-app.json', 'guide-react.tsx'], env: { NODE_ENV: 'development' } },
      { name: 'guide: browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--modules', 'guide', '--tsconfig', 'tsconfig.react-app.json'] },
    ],
  },
  // The guide's Angular page needs nothing the builder does not declare but
  // the workbench's stylesheet, so the builder's own host builds it too.
  angular: {
    builder: '@formancy/report-builder-angular',
    consumer: 'angular.ts',
    guide: { kind: 'angular', entry: 'report-page.ts', runner: 'guide-angular.ts', prints: false, bundled: true },
    peers: ['@angular/core'],
    // compiler-cli compiles the host and links the builder, which needs the
    // compiler; common and the two platforms draw it on a server.
    follows: Object.fromEntries(['common', 'compiler', 'compiler-cli', 'platform-browser', 'platform-server'].map((name) => [`@angular/${name}`, ['@angular/core', together]])),
    // What @angular/core's declarations import, and the stylesheet the guide's page lists.
    fixed: { rxjs: '^7.8.1', '@formancy/themes': THEMES },
    tools: { typescript: TYPESCRIPT, esbuild: ESBUILD },
    // What an Angular CLI project compiles with, as far as it bears on what
    // is checked: strict templates, and the module resolution a bundler has.
    tsconfig: {
      file: 'tsconfig.angular.json',
      content: {
        compilerOptions: { ...STRICT, ...BROWSER, target: 'ES2022', module: 'preserve', moduleResolution: 'bundler', outDir: 'out' },
        include: ['angular.ts', 'guide-angular.ts', 'guide'],
        angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true, strictInputAccessModifiers: true },
      },
    },
    steps: [
      { name: 'compile ahead of time', command: ['ngc', '-p', 'tsconfig.angular.json'] },
      { name: 'server build', command: ['node', 'build.mjs', '--platform', 'node', '--entry', 'out/angular.js', '--outfile', 'out/angular.server.mjs', '--link', '@formancy/report-builder-angular'] },
      { name: 'run', command: ['node', 'out/angular.server.mjs'] },
      { name: 'browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--exports', '@formancy/report-builder-angular', '--link', '@formancy/report-builder-angular'] },
      { name: 'guide: server build', command: ['node', 'build.mjs', '--platform', 'node', '--entry', 'out/guide-angular.js', '--outfile', 'out/guide-angular.server.mjs', '--link', '@formancy/report-builder-angular'] },
      { name: 'guide: run', command: ['node', 'out/guide-angular.server.mjs'] },
      { name: 'guide: browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--modules', 'out/guide', '--link', '@formancy/report-builder-angular'] },
    ],
  },
}

/** What docs/getting-started.md is built by: each host's guide, the order of HOSTS. */
export const GUIDE_HOSTS = Object.values(HOSTS).flatMap((host) => (host.guide === undefined ? [] : [host.guide]))

/**
 * The version `range` starts from. Only a range with one floor this can
 * name is read -- `^1.2.3`, `~1.2.3`, `>=1.2.3` or `1.2.3` -- and any other
 * is refused rather than guessed at.
 */
export function floorOf(range) {
  const floor = /^(?:\^|~|>=)?(\d+\.\d+\.\d+)$/.exec(range.trim())?.[1]
  if (floor === undefined) throw new Error(`cannot read the floor of the peer range ${range}; install-hosts.mjs reads ^, ~, >= and an exact version`)
  return floor
}

/** `name` and every @formancy package it declares, transitively, among those packed. */
function closureOf(name, manifests) {
  const found = new Set()
  const visit = (current) => {
    if (found.has(current) || !manifests.has(current)) return
    found.add(current)
    for (const dependency of Object.keys(manifests.get(current).dependencies ?? {})) visit(dependency)
  }
  visit(name)
  return [...found].sort()
}

/** What a builder's host installs of its framework, at the newest release its peers admit or at their floor. */
function frameworkOf(host, manifest, at) {
  const declared = manifest.peerDependencies ?? {}
  const unknown = Object.keys(declared).filter((peer) => !host.peers.includes(peer))
  if (unknown.length > 0) throw new Error(`${host.builder} declares peers its host does not install: ${unknown.join(', ')}`)
  const spec = (peer) => {
    const range = declared[peer]
    if (range === undefined) throw new Error(`${host.builder} declares no peer on ${peer}, so no version of it is the one to check`)
    return at === 'floor' ? floorOf(range) : range
  }
  return {
    ...Object.fromEntries(host.peers.map((peer) => [peer, spec(peer)])),
    ...Object.fromEntries(Object.entries(host.follows ?? {}).map(([name, [peer, follow]]) => [name, follow(spec(peer), at)])),
    ...host.fixed,
  }
}

/**
 * `main` -- a host's builder, or what it serves -- and what it installs
 * beside it (`with`), each with every package it declares, transitively;
 * refused where one beside it was not packed.
 */
function packagesOf(kind, host, main, manifests) {
  const beside = host.with ?? []
  const unpacked = beside.filter((name) => !manifests.has(name))
  if (unpacked.length > 0) throw new Error(`${unpacked.join(', ')} was not packed, so the ${kind} host would be checked without it`)
  return [...new Set([main, ...beside].flatMap((name) => closureOf(name, manifests)))].sort()
}

/**
 * The projects to install, from the packed manifests (`name` to manifest):
 * the Node host with every package that is no host's own, the server's
 * host with the server and the client and what they declare, the client's
 * host with the client and what it declares, and each builder's host at
 * the newest release its peers admit and at their floor.
 */
export function planProjects(manifests) {
  const builders = new Set(Object.values(HOSTS).flatMap((host) => (host.builder === undefined ? [] : [host.builder])))
  const served = new Set(Object.values(HOSTS).flatMap((host) => (host.serves === undefined ? [] : [host.serves])))
  const orphans = [...manifests].filter(([name, manifest]) => !builders.has(name) && Object.keys(manifest.peerDependencies ?? {}).length > 0).map(([name]) => name)
  if (orphans.length > 0) throw new Error(`no host installs ${orphans.join(', ')}, which declares peers; give it one in install-hosts.mjs`)

  return Object.entries(HOSTS).flatMap(([kind, host]) => {
    const common = {
      host: kind,
      builder: host.builder ?? null,
      browser: host.builder !== undefined || host.browser === true,
      consumer: host.consumer,
      guide: host.guide ?? null,
      tools: host.tools,
      tsconfig: host.tsconfig,
      steps: host.steps,
    }
    if (host.serves !== undefined) {
      if (!manifests.has(host.serves)) throw new Error(`${host.serves} was not packed, so the ${kind} host has nothing to check`)
      return [{ name: kind, at: null, packages: packagesOf(kind, host, host.serves, manifests), framework: {}, ...common }]
    }
    if (host.builder === undefined) {
      return [{ name: kind, at: null, packages: [...manifests.keys()].filter((name) => !builders.has(name) && !served.has(name)).sort(), framework: {}, ...common }]
    }
    const manifest = manifests.get(host.builder)
    if (manifest === undefined) throw new Error(`${host.builder} was not packed, so its host has nothing to check`)
    const packages = packagesOf(kind, host, host.builder, manifests)
    return ['newest', 'floor'].map((at) => ({ name: at === 'floor' ? `${kind}-floor` : kind, at, packages, framework: frameworkOf(host, manifest, at), ...common }))
  })
}
