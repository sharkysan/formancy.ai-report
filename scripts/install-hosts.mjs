/**
 * What the install gate installs, and where.
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
 */

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
const STRICT = { strict: true, skipLibCheck: false }
/** A browser host's code: the DOM, and no Node. */
const BROWSER = { lib: ['ES2023', 'DOM', 'DOM.Iterable'], types: [] }

/** A package that follows a peer, released with it at the same version: Angular's. */
const together = (spec) => spec
/** DefinitelyTyped publishes a release line per minor with patches of its own: at the floor, the floor's line. */
const typesOf = (spec, at) => (at === 'floor' ? `~${spec.split('.').slice(0, 2).join('.')}.0` : spec)

/**
 * The hosts, in the order the gate reports them. `node` takes every
 * package that is no host's builder. Each builder's host lists the peers
 * its builder must declare, what follows them, and what it runs, in order.
 * A command whose program is not `node` is a binary installed in the
 * project.
 */
export const HOSTS = {
  // A Node program with no DOM and no framework: what it imports -- every
  // package but the builders -- must need no DOM type, and only Node's.
  node: {
    consumer: 'consume.ts',
    tools: { '@types/node': '^22.10.0', typescript: TYPESCRIPT, tsx: TSX },
    tsconfig: {
      file: 'tsconfig.consume.json',
      content: { compilerOptions: { ...STRICT, target: 'ES2023', module: 'NodeNext', moduleResolution: 'nodenext', lib: ['ES2023'], types: ['node'], noEmit: true }, include: ['consume.ts'] },
    },
    steps: [
      { name: 'type-check', command: ['tsc', '-p', 'tsconfig.consume.json'] },
      { name: 'run', command: ['tsx', '--tsconfig', 'tsconfig.consume.json', 'consume.ts'] },
    ],
  },
  react: {
    builder: '@formancy/report-builder-react',
    consumer: 'react.tsx',
    peers: ['react', 'react-dom'],
    follows: { '@types/react': ['react', typesOf], '@types/react-dom': ['react-dom', typesOf] },
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
  angular: {
    builder: '@formancy/report-builder-angular',
    consumer: 'angular.ts',
    peers: ['@angular/core'],
    // compiler-cli compiles the host and links the builder, which needs the
    // compiler; common and the two platforms draw it on a server.
    follows: Object.fromEntries(['common', 'compiler', 'compiler-cli', 'platform-browser', 'platform-server'].map((name) => [`@angular/${name}`, ['@angular/core', together]])),
    // What @angular/core's declarations import.
    fixed: { rxjs: '^7.8.1' },
    tools: { typescript: TYPESCRIPT, esbuild: ESBUILD },
    // What an Angular CLI project compiles with, as far as it bears on what
    // is checked: strict templates, and the module resolution a bundler has.
    tsconfig: {
      file: 'tsconfig.angular.json',
      content: {
        compilerOptions: { ...STRICT, ...BROWSER, target: 'ES2022', module: 'preserve', moduleResolution: 'bundler', outDir: 'out' },
        files: ['angular.ts'],
        angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true, strictInputAccessModifiers: true },
      },
    },
    steps: [
      { name: 'compile ahead of time', command: ['ngc', '-p', 'tsconfig.angular.json'] },
      { name: 'server build', command: ['node', 'build.mjs', '--platform', 'node', '--entry', 'out/angular.js', '--outfile', 'out/angular.server.mjs', '--link', '@formancy/report-builder-angular'] },
      { name: 'run', command: ['node', 'out/angular.server.mjs'] },
      { name: 'browser build', command: ['node', 'build.mjs', '--platform', 'browser', '--exports', '@formancy/report-builder-angular', '--link', '@formancy/report-builder-angular'] },
    ],
  },
}

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
 * The projects to install, from the packed manifests (`name` to manifest):
 * the Node host with every package that is no builder, and each builder's
 * host at the newest release its peers admit and at their floor.
 */
export function planProjects(manifests) {
  const builders = new Set(Object.values(HOSTS).flatMap((host) => (host.builder === undefined ? [] : [host.builder])))
  const orphans = [...manifests].filter(([name, manifest]) => !builders.has(name) && Object.keys(manifest.peerDependencies ?? {}).length > 0).map(([name]) => name)
  if (orphans.length > 0) throw new Error(`no host installs ${orphans.join(', ')}, which declares peers; give it one in install-hosts.mjs`)

  return Object.entries(HOSTS).flatMap(([kind, host]) => {
    const common = { host: kind, consumer: host.consumer, tools: host.tools, tsconfig: host.tsconfig, steps: host.steps }
    if (host.builder === undefined) {
      return [{ name: kind, at: null, packages: [...manifests.keys()].filter((name) => !builders.has(name)).sort(), framework: {}, ...common }]
    }
    const manifest = manifests.get(host.builder)
    if (manifest === undefined) throw new Error(`${host.builder} was not packed, so its host has nothing to check`)
    const packages = closureOf(host.builder, manifests)
    return ['newest', 'floor'].map((at) => ({ name: at === 'floor' ? `${kind}-floor` : kind, at, packages, framework: frameworkOf(host, manifest, at), ...common }))
  })
}
