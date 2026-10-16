// The report's "Tested on" (0014; formancy.ai-data 0035): what this run's
// jobs and install hosts met, beside what the checkout says it is tested
// with.
//
// Pure over the run's results and testedOn()'s facts. Each runtime
// dependency and upstream package is shown as published, as the suites
// loaded it, and as a clean `npm install` of the tarballs resolved it --
// every version it resolved, with the hosts that resolved each; each
// builder's peers as declared and as each install host resolved them --
// React and Angular at the newest and the oldest release their ranges admit;
// Node as every job ran it; and each browser a browser gate or a pictures'
// check launched, beside the build Playwright pins for it.

import { installOf } from './results.mjs'

const distinct = (values) => [...new Set(values)]

/**
 * Every version a clean install resolved for `name`, in the gate's order,
 * each with the hosts whose tree held it -- `[{ version, hosts }]`, empty
 * when the install gate did not report it. Each host resolves its own tree,
 * so one package can come out at two versions.
 */
function freshFor(install, name) {
  const versions = distinct((install?.resolved ?? []).filter((resolved) => resolved.name === name).map((resolved) => resolved.version))
  return versions.map((version) => ({
    version,
    hosts: (install?.consumers ?? []).filter((consumer) => (consumer.resolved ?? []).some((resolved) => resolved.name === name && resolved.version === version)).map((consumer) => consumer.project),
  }))
}

/**
 * Each builder's peers as the install hosts resolved them: per peer, every
 * version any host installed, with the end of the range it was installed at.
 * A host is a builder's when it installed one of its peers.
 */
function hostsFor(install, peers) {
  return peers.map((peer) => {
    const hosts = (install?.consumers ?? []).filter((consumer) => consumer.installed?.[peer.name] != null)
    return { ...peer, installed: hosts.map((consumer) => ({ project: consumer.project, at: consumer.at ?? null, version: consumer.installed[peer.name] })) }
  })
}

/**
 * Every browser the run's browser gates and pictures' checks launched, by
 * name, version and whether headless, with what launched it and the version
 * Playwright pins for it (null for a browser no gate here runs, which
 * problems.mjs fails).
 */
function launchedIn(results, browser) {
  const launches = results.flatMap((result) => [
    ...(result.browserGates ?? []).filter((gate) => gate.browser != null).map((gate) => ({ ...gate.browser, by: `the browser gate of ${gate.gate}` })),
    ...(result.pictures ?? []).filter((check) => check.browser != null).map((check) => ({ ...check.browser, by: `the pictures’ check of ${check.app}` })),
  ])
  const seen = new Map()
  for (const { name, version, headless, by } of launches) {
    const key = `${name} ${version} ${String(headless)}`
    seen.set(key, { name, version, headless, pin: browser.pins.find((pin) => pin.browser === name)?.browserVersion ?? null, by: distinct([...(seen.get(key)?.by ?? []), by]) })
  }
  return [...seen.values()]
}

/** The run's Tested on: dependencies range -> loaded -> fresh, peers per host, upstream, Node, npm, pnpm, the browsers and the tools. */
export function testedOnInRun({ results, facts }) {
  const install = installOf(results)
  return {
    runtime: facts.runtime.map((entry) => ({ ...entry, fresh: freshFor(install, entry.name) })),
    peers: hostsFor(install, facts.peers),
    upstream: facts.upstream.map((entry) => ({ ...entry, fresh: freshFor(install, entry.name) })),
    installedAt: install?.startedAt ?? null,
    node: {
      ...facts.node,
      ran: distinct(results.map((result) => result.runner?.node).filter((node) => node != null)).sort(),
      install: install?.node ?? null,
    },
    npm: install?.npm ?? null,
    // What each install host type-checked its consumer with, skipLibCheck off.
    hostTools: distinct((install?.consumers ?? []).flatMap((consumer) => Object.entries(consumer.tools ?? {}).map(([name, version]) => `${name} ${String(version)}`))).sort(),
    packageManager: facts.packageManager,
    browser: facts.browser,
    browsers: launchedIn(results, facts.browser),
    // The axe-core each browser gate injected into the page, as the page reported it.
    axe: distinct(results.flatMap((result) => (result.browserGates ?? []).map((gate) => gate.axe)).filter((version) => version != null)),
    tooling: facts.tooling,
    runners: [...new Map(results.map((result) => [`${result.runner?.image ?? ''} ${result.runner?.imageVersion ?? ''}`, { image: result.runner?.image ?? null, imageVersion: result.runner?.imageVersion ?? null }])).values()],
  }
}
