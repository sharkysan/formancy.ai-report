import { readFile } from 'node:fs/promises'
import { openReportServer, readAgainOnSignal } from './serve.js'
import { readSettings } from './settings.js'

/**
 * The runnable server: `node dist/main.mjs`, the container's command.
 *
 * The composition root (0046), and the only module that reads
 * configuration: the environment once, here, handed to settings.ts to
 * parse and to serve.ts as the source a secret reference is read through.
 * A server that is not configured -- no issuer, audience, identity key,
 * tenant claim or store directory, or any setting it would refuse -- does
 * not start: it prints one line for each problem, each naming its setting
 * and none repeating a value, and exits 1. The settings are listed, with
 * what each is for, in settings.ts's SETTINGS and the package README.
 */
const read = readSettings(process.env)
if (!read.ok) {
  for (const problem of read.problems) console.error(problem)
  process.exit(1)
}
const { settings } = read

// The log, the audit trail among it, goes to standard output, where a
// container's collector reads it.
const opened = await openReportServer(settings, { env: process.env, readFile: (path) => readFile(path, 'utf8') }, { stream: process.stdout })
if (!opened.ok) {
  console.error(opened.problem)
  process.exit(1)
}
const { app, keyFile } = opened

// What the server runs on, without a value an operator would not log
// themselves: how many roles hold each capacity, the proxies and origins
// it trusts, the directory it keeps its store in -- a path, not a secret --
// whether the trail names who asked, and the key set's kids.
app.log.info(
  {
    capacities: Object.fromEntries(Object.entries(settings.roles).map(([capacity, roles]) => [capacity, roles.length])),
    trustedProxies: settings.trustedProxies,
    origins: settings.origins,
    storeDir: settings.storeDir,
    auditNamesWho: settings.auditKey !== undefined,
    ...(keyFile === undefined ? {} : { identityKeys: { kids: keyFile.current().kids, leftOut: keyFile.current().leftOut } }),
  },
  'serving',
)

// SIGHUP reads the key set file again, and with one key says it read
// nothing; either way it no longer stops the server, which is Node's
// default. Installed before listen, so no signal arrives without it.
readAgainOnSignal(process, keyFile, app.log)

// On SIGTERM a container stops taking requests and finishes the ones in flight.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: '0.0.0.0', port: settings.port })
