import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { floorOf, planProjects } from './install-hosts.mjs'

/**
 * What the install gate installs, and where: a project per kind of host,
 * holding only what that host would, and each builder at both ends of its
 * peer range. The gate itself only shows that what it installed works; this
 * holds what it installs to what the packed manifests say.
 */

describe('the floor of a peer range', () => {
  // The floor project installs the oldest release a range admits. Read
  // wrong, it installs a newer one, passes, and says it checked the floor.
  test('is the version a caret, a tilde, a >= or an exact version starts from', () => {
    expect(floorOf('^19.0.0')).toBe('19.0.0')
    expect(floorOf('~22.1.3')).toBe('22.1.3')
    expect(floorOf('>=22.0.0')).toBe('22.0.0')
    expect(floorOf('19.2.1')).toBe('19.2.1')
  })

  // A range with two floors, or one this cannot name, is refused rather
  // than guessed at, so a peer range widened to `^18 || ^19` fails the gate
  // until someone says which floor to install.
  test('is refused when the range has none, or more than one', () => {
    for (const range of ['^18.0.0 || ^19.0.0', '19.x', '*', '>=19.0.0 <20.0.0', '^19.0.0-rc.1', 'workspace:*', 'latest']) {
      expect(() => floorOf(range), range).toThrow(/floor/)
    }
  })
})

/** The packed manifests, as the gate reads them out of the tarballs: the shape of this repository's, with its peers. */
const manifests = new Map([
  ['@formancy/report-spec', { dependencies: {} }],
  ['@formancy/report-core', { dependencies: { '@formancy/report-spec': '0.1.0' } }],
  ['@formancy/report-builder-core', { dependencies: { '@formancy/report-core': '0.1.0', '@formancy/report-spec': '0.1.0' } }],
  ['@formancy/report-runtime', { dependencies: { '@formancy/report-core': '0.1.0', '@formancy/report-spec': '0.1.0', decimal: '1.0.0' } }],
  ['@formancy/report-render-pdf', { dependencies: { '@formancy/report-runtime': '0.1.0', pdfmake: '0.3.11' } }],
  ['@formancy/report-builder-react', { dependencies: { '@formancy/report-builder-core': '0.1.0' }, peerDependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' } }],
  ['@formancy/report-builder-angular', { dependencies: { '@formancy/report-builder-core': '0.1.0', tslib: '^2.8.0' }, peerDependencies: { '@angular/core': '^22.0.0' } }],
  ['@formancy/report-server-core', { dependencies: {} }],
  ['@formancy/report-server', { dependencies: { '@formancy/report-server-core': '0.1.0', fastify: '5.12.7' } }],
  ['@formancy/report-client', { dependencies: { '@formancy/report-server-core': '0.1.0', '@formancy/report-spec': '0.1.0' } }],
])
const named = (name) => planProjects(manifests).find((project) => project.name === name)
/** The workbench release the Studio declares, which the guide's pages install. */
const themes = JSON.parse(readFileSync(new URL('../apps/studio/package.json', import.meta.url), 'utf8')).dependencies['@formancy/themes']

describe('the projects the gate installs', () => {
  // A project for every host and both ends of each builder's range; one
  // missing is a host nobody checks.
  test('are a Node host, the server\'s and the client\'s, and each builder at the newest release its peers admit and at their floor', () => {
    expect(planProjects(manifests).map(({ name, consumer }) => `${name}: ${consumer}`)).toEqual([
      'node: consume.ts',
      'server: server.ts',
      'client: client.ts',
      'react: react.tsx',
      'react-floor: react.tsx',
      'react-app: guide-react.tsx',
      'react-app-floor: guide-react.tsx',
      'angular: angular.ts',
      'angular-floor: angular.ts',
    ])
  })

  // A builder installed beside every other package resolves an import of
  // one it never declared, and a host that installs only the builder does
  // not: the gate would pass a tarball that fails there.
  test('install a builder with only the packages it declares, transitively, and the Node host with the rest', () => {
    expect(named('react')?.packages).toEqual(['@formancy/report-builder-core', '@formancy/report-builder-react', '@formancy/report-core', '@formancy/report-spec'])
    expect(named('angular-floor')?.packages).toEqual(['@formancy/report-builder-angular', '@formancy/report-builder-core', '@formancy/report-core', '@formancy/report-spec'])
    expect(named('node')?.packages).toEqual(['@formancy/report-builder-core', '@formancy/report-core', '@formancy/report-render-pdf', '@formancy/report-runtime', '@formancy/report-server-core', '@formancy/report-spec'])
  })

  // The server's host is a Node host with the server and what it declares
  // and nothing else, so a server that imported the runtime, the renderer
  // or any package it never declared fails there, where the Node host,
  // which installs them all, would pass it (0046). The client is beside
  // it, with what it declares, so that the packed client is asked of the
  // packed server over a socket (0049).
  test('install the server and its client with only the packages they declare, transitively, and no framework', () => {
    expect(named('server')?.packages).toEqual(['@formancy/report-client', '@formancy/report-server', '@formancy/report-server-core', '@formancy/report-spec'])
    expect(named('server')?.framework).toEqual({})
    expect(named('server')?.at).toBeNull()
    expect(named('node')?.packages).not.toContain('@formancy/report-server')
    expect(named('server')?.tsconfig.content.compilerOptions.types).toEqual(['node'])
  })

  // A page talks to the server through the client, so the client's host
  // is a browser's: the client and what it declares, the DOM's types and
  // none of Node's, and a bundle of what it exports. A client that imported
  // a `node:` module, or whose declarations named a Node type, fails there,
  // where the server's host, which has Node's types, would pass it (0049).
  test("install the client in a browser's host, with only the packages it declares and no Node package", () => {
    expect(named('client')?.packages).toEqual(['@formancy/report-client', '@formancy/report-server-core', '@formancy/report-spec'])
    expect(named('client')?.framework).toEqual({})
    expect(named('client')?.at).toBeNull()
    expect(named('client')?.browser).toBe(true)
    expect(named('client')?.tools).not.toHaveProperty(['@types/node'])
    expect(named('client')?.steps.map((step) => step.command.join(' '))).toEqual(['tsc -p tsconfig.client.json', 'node build.mjs --platform browser --exports @formancy/report-client'])
    expect(named('node')?.packages).not.toContain('@formancy/report-client')
  })

  // The install gate refuses @types/node in a browser's host -- each
  // builder's, and the client's -- keyed on what the project is for, and
  // each is checked against the DOM's types and none of Node's. Were the
  // guard keyed on the host's own types, one edit giving a browser's host
  // Node's types would also silence it; here that edit fails, and a Node
  // host is never mistaken for a browser's.
  test("check each browser's host against the DOM's types alone, and every other host against Node's", () => {
    const projects = planProjects(manifests)
    const browsers = projects.filter((project) => project.browser)
    expect(browsers.map((project) => project.name).sort()).toEqual(['angular', 'angular-floor', 'client', 'react', 'react-app', 'react-app-floor', 'react-floor'])
    for (const project of projects.filter((each) => each.builder !== null)) expect(project.browser, project.name).toBe(true)
    for (const project of browsers) {
      expect(project.tsconfig.content.compilerOptions.types, project.name).toEqual([])
      expect(project.tsconfig.content.compilerOptions.lib, project.name).toContain('DOM')
    }
    for (const project of projects.filter((each) => !each.browser)) expect(project.tsconfig.content.compilerOptions.types, project.name).toEqual(['node'])
  })

  // A server host planned without the server would check nothing; one
  // without the client would never ask the server as a host's page does,
  // and pass a client that cannot talk to it.
  test('refuse to plan the server host without the server, or without the client', () => {
    const without = (name) => new Map([...manifests].filter(([each]) => each !== name))
    expect(() => planProjects(without('@formancy/report-server'))).toThrow(/@formancy\/report-server was not packed, so the server host has nothing to check/)
    expect(() => planProjects(without('@formancy/report-client'))).toThrow(/@formancy\/report-client was not packed, so the server host would be checked without it/)
  })

  // The guide's React page previews in the browser, so it installs the
  // renderer beside the builder, each with what it declares, and the
  // workbench's stylesheet -- in a project of its own, so that the builder's
  // own project still refuses an import of the renderer it never declared.
  test("install the guide's React page with the builder, the renderer and the Studio's workbench release, at both ends of React's range", () => {
    expect(named('react-app')?.packages).toEqual(['@formancy/report-builder-core', '@formancy/report-builder-react', '@formancy/report-core', '@formancy/report-render-pdf', '@formancy/report-runtime', '@formancy/report-spec'])
    expect(named('react-app-floor')?.framework).toEqual({ react: '19.0.0', 'react-dom': '19.0.0', '@types/react': '~19.0.0', '@types/react-dom': '~19.0.0', '@formancy/themes': themes })
    expect(named('react')?.packages).not.toContain('@formancy/report-render-pdf')
    expect(named('react')?.framework).not.toHaveProperty(['@formancy/themes'])
    expect(named('react-app')?.guide?.kind).toBe('react')
    expect(named('angular-floor')?.guide?.kind).toBe('angular')
  })

  // Without the renderer packed, the page would be installed without it and
  // fail in a way that names the guide rather than the missing tarball.
  test("refuse to plan the guide's React page without the renderer", () => {
    const unpacked = new Map([...manifests].filter(([name]) => name !== '@formancy/report-render-pdf'))
    expect(() => planProjects(unpacked)).toThrow(/report-render-pdf was not packed, so the react-app host/)
  })

  // Installed from the range alone, npm takes the newest release, and a
  // builder that needs more than its floor -- an API added later, a React
  // bundled in -- passes; the floor project installs the oldest release.
  test("install React at its range's newest release and at its floor, with React's types on the same release line", () => {
    expect(named('react')?.framework).toEqual({ react: '^19.0.0', 'react-dom': '^19.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' })
    expect(named('react-floor')?.framework).toEqual({ react: '19.0.0', 'react-dom': '19.0.0', '@types/react': '~19.0.0', '@types/react-dom': '~19.0.0' })
  })

  // Angular's packages are released together and require one another at
  // exactly one version, so each follows @angular/core's version.
  test('install every Angular package at the one version, at the newest and at the floor', () => {
    const angular = (version) => ({
      '@angular/core': version,
      '@angular/common': version,
      '@angular/compiler': version,
      '@angular/compiler-cli': version,
      '@angular/platform-browser': version,
      '@angular/platform-server': version,
      rxjs: '^7.8.1',
      '@formancy/themes': themes,
    })
    expect(named('angular')?.framework).toEqual(angular('^22.0.0'))
    expect(named('angular-floor')?.framework).toEqual(angular('22.0.0'))
  })

  // The Node host has no framework: React in it would let a Node package's
  // declarations name React's types and pass.
  test('give the Node host no framework', () => {
    expect(named('node')?.framework).toEqual({})
  })

  // A package with peers is a builder for some host. Put in the Node
  // project, npm would install its peers there and nothing would import it.
  test('refuse a package with peers that no host installs', () => {
    const vue = new Map([...manifests, ['@formancy/report-builder-vue', { peerDependencies: { vue: '^3.5.0' } }]])
    expect(() => planProjects(vue)).toThrow(/report-builder-vue/)
  })

  // A peer the host does not know is one its project would not install, so
  // the builder would be checked without it; and a builder with no peer on
  // its framework is checked against whatever version the host picks.
  test('refuse a builder whose peers are not its framework', () => {
    const extra = new Map([...manifests, ['@formancy/report-builder-react', { peerDependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'react-router': '^7.0.0' } }]])
    expect(() => planProjects(extra)).toThrow(/react-router/)
    const none = new Map([...manifests, ['@formancy/report-builder-angular', { peerDependencies: {} }]])
    expect(() => planProjects(none)).toThrow(/@angular\/core/)
  })

  // A host listed for a builder that was not packed would plan a project
  // with nothing in it to check.
  test('refuse a host whose builder was not packed', () => {
    const missing = new Map([...manifests].filter(([name]) => name !== '@formancy/report-builder-react'))
    expect(() => planProjects(missing)).toThrow(/report-builder-react/)
  })
})
