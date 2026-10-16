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
// Node as every job ran it.

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

/** The run's Tested on: dependencies range -> loaded -> fresh, peers per host, upstream, Node, npm, pnpm and the tools. */
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
    tooling: facts.tooling,
    runners: [...new Map(results.map((result) => [`${result.runner?.image ?? ''} ${result.runner?.imageVersion ?? ''}`, { image: result.runner?.image ?? null, imageVersion: result.runner?.imageVersion ?? null }])).values()],
  }
}
