#!/usr/bin/env node
/**
 * The container gate (0046): the server's image, built from this checkout
 * and run, as the `container` job in gates.yml runs it.
 *
 * packages/report-server/src/dockerfile.test.ts holds what the Dockerfile
 * says; this holds what the image does, which nothing else here sees -- a
 * file the runtime stage drops, a module that resolves in the workspace and
 * not in the deployed tree, a setting main.ts does not read. formancy's
 * image once built cleanly, passed every test and exited on startup with
 * ERR_MODULE_NOT_FOUND; Formancy Data's container job exists for that, and
 * this is its shape (formancy.ai-data's gates.yml), written as a script so
 * it runs the same on a machine and in CI and leaves a record either way.
 *
 *   node scripts/container.mjs [--image <tag>] [--docker <program>] [--out <file>] [--remove-image]
 *
 * Unconfigured, the image must stop and name every setting it needs; with
 * a secret reference it cannot resolve, stop with exit 1 and that one
 * sentence, no stack trace. Configured, it must answer /health; refuse whoami without a token, with
 * a forgery and without a tenant, with the one 401; answer whoami for a
 * token signed here, with its tenant and the actions its roles give; answer
 * nothing else; say no-store; run as `node`; carry the repository's own
 * LICENSE.md and NOTICE; write its store directory and not its own code;
 * run on a read-only root file system; write one audit line per request
 * whoami answered, holding no token; live through SIGHUP and stop on
 * SIGTERM; and, given a key set file, name its kids when it starts and
 * read it again on SIGHUP. And each public setting it reads -- the rate limit, the trusted
 * proxies, the origins -- must change what it does, or stop it, naming the
 * setting, when it is not one.
 *
 * The host secret is made here, at random, for this run alone. Every
 * container is removed however the gate ends; the image is kept, for
 * collect.mjs to read, unless --remove-image says otherwise.
 *
 * It writes test-results/container.json however it ends: whether it
 * passed, the Docker it ran on, the image it built -- its id, its size, and
 * the Node and the user it runs, each asked of the image itself, labelled
 * the gate's image and never a published one -- every check it planned and
 * made, and how long the build and the start took. Which base the image is
 * built on is the Dockerfile's to say, by a digest Docker verifies when it
 * pulls, and dockerfile.test.ts holds the pin; the record does not repeat
 * it. Node's built-ins only.
 *
 * Its waits are choices, not measurements: 30 s for a container to answer
 * or to stop, some forty times the 0.65 to 0.78 s to healthy it measured on
 * 2026-10-22, so a loaded runner is not taken for a broken image; 1 s for
 * SIGHUP's line, which the server writes as the signal arrives; 10 s
 * for SIGTERM, Docker's own default for `docker stop`; and, so that no wait
 * is a promise nothing settles -- a request whose connection went away
 * without an answer, which once left the gate's top-level await pending
 * with nothing to keep Node running, so that it exited 13 and wrote no
 * record -- 10 s for any one request (2 s while waiting for health) and
 * 120 s for any one check, each on a timer that keeps Node running and
 * fails what it waits for, by name.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

const option = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? fallback : process.argv[at + 1]
}
const image = option('--image', 'formancy/report-server:gate')
const dockerProgram = option('--docker', 'docker')
const out = resolve(repo, option('--out', 'test-results/container.json'))
const removeImage = process.argv.includes('--remove-image')

/** The image the server's Dockerfile builds on, `node:<version>-<os>@sha256:…`, as its build stage names it; the report holds the Node the gate's image runs to its tag. */
export function baseImage(root = repo) {
  return /^FROM (\S+) AS build$/m.exec(readFileSync(join(root, 'packages', 'report-server', 'Dockerfile'), 'utf8'))?.[1] ?? null
}

/** The checks, in the order they are made; the record lists each, made or not. */
export const CHECKS = [
  'unconfigured, it stops and names every setting it needs',
  'a secret reference it cannot resolve stops it, exit 1, with one sentence and no stack trace',
  'configured, it answers /health',
  'whoami without a token is the one 401',
  'whoami answers a token the host signed, with its tenant and the actions its roles give',
  'a forgery and a token without its tenant are the same 401',
  'nothing else answers, with a 404 that quotes nothing',
  'every answer says Cache-Control: no-store',
  'it runs as node',
  'it carries the repository’s LICENSE.md and NOTICE',
  'it can write its store directory',
  'it cannot write its own code',
  'its log holds one audit line per request whoami answered, and no token',
  'SIGHUP leaves a server with one key running',
  'SIGTERM stops it, exit 0',
  'it runs on a read-only root file system',
  'with a key set file, it names the kids it serves under, and SIGHUP reads the file again',
  'FORMANCY_REPORT_RATE_LIMIT=2 answers 401 401 429',
  'FORMANCY_REPORT_RATE_LIMIT=abc stops it, naming the setting',
  'FORMANCY_REPORT_TRUSTED_PROXIES splits the limit by the address a named proxy forwards',
  'FORMANCY_REPORT_TRUSTED_PROXIES=true stops it, naming the setting',
  'FORMANCY_REPORT_CORS_ORIGINS grants a listed origin’s preflight and refuses another',
]

/** `docker args…`: its exit status and what it printed, never a throw. */
function docker(args, { input } = {}) {
  const ran = spawnSync(dockerProgram, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(input === undefined ? {} : { input }) })
  if (ran.error !== undefined) return { status: null, stdout: '', stderr: String(ran.error.message), output: String(ran.error.message) }
  return { status: ran.status, stdout: ran.stdout, stderr: ran.stderr, output: `${ran.stdout}${ran.stderr}` }
}

/** `docker args…`, its standard output, or a throw naming the command and what it said. */
function must(args) {
  const ran = docker(args)
  if (ran.status !== 0) throw new Error(`docker ${args.join(' ')} failed: ${ran.output.trim().slice(0, 2000)}`)
  return ran.stdout.trim()
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** `fetch(url, init)`, failed by its own deadline, `ms`, naming the request, where no answer ever comes. */
async function request(url, init = {}, ms = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`${init.method ?? 'GET'} ${url} had no answer within ${String(ms / 1000)} s`)), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** How long any one check may take, a choice (above). */
const CHECK_MS = 120_000

const secret = randomBytes(32).toString('base64url')
const ISSUER = 'https://host.example'
const AUDIENCE = 'formancy-report'
const base64url = (text) => Buffer.from(text).toString('base64url')
/** An HS256 token, as a host signs one with nothing but its secret, or a key set's key under its `kid`. */
function sign(claims, key = secret, kid = undefined) {
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...(kid === undefined ? {} : { kid }) }))}.${base64url(JSON.stringify(claims))}`
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`
}
const now = Math.floor(Date.now() / 1000)
const claims = { iss: ISSUER, aud: AUDIENCE, sub: 'u-1', tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 600 }
const token = sign(claims)
const { tid: _tenant, ...tenantless } = claims
const tokens = { good: token, tenantless: sign(tenantless), forged: sign(claims, randomBytes(32).toString('base64url')) }

/** The settings every configured container starts from. */
const CONFIGURED = {
  FORMANCY_REPORT_ISSUER: ISSUER,
  FORMANCY_REPORT_AUDIENCE: AUDIENCE,
  FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET',
  HOST_SECRET: secret,
  FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid',
  FORMANCY_REPORT_AUTHOR_ROLES: 'report-authors',
}
const envArgs = (env) => Object.entries(env).flatMap(([name, value]) => ['-e', `${name}=${value}`])

const started = []
const run = String(process.pid)
/**
 * A container of the image, started detached, its port published on
 * loopback at a port Docker picks, and each of `files` -- a path inside
 * from a file here -- copied in before it starts; its name.
 */
function start(label, env, { publish = true, flags = [], files = {} } = {}) {
  const name = `formancy-report-gate-${run}-${String(started.length)}-${label}`
  started.push(name)
  must(['create', '--name', name, ...flags, ...(publish ? ['-p', '127.0.0.1::4392'] : []), ...envArgs(env), image])
  for (const [inside, from] of Object.entries(files)) must(['cp', from, `${name}:${inside}`])
  must(['start', name])
  return name
}

/** A container's log lines that are JSON, parsed: the server's own. */
const logLines = (name) =>
  docker(['logs', name])
    .output.split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
const at = (name) => `http://${must(['port', name, '4392/tcp']).split('\n')[0]}`

/** Waits for a container to answer /health from the host, up to 30 s, a choice (above); how long it took, in ms. */
async function healthy(name) {
  const from = Date.now()
  const base = at(name)
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await request(`${base}/health`, {}, 2_000)).ok) return Date.now() - from
    } catch {
      // Not listening yet.
    }
    await sleep(500)
  }
  throw new Error(`${name} did not answer /health within 30 s: ${docker(['logs', name]).output.trim().slice(0, 2000)}`)
}

/** Waits up to 30 s, a choice (above), for a container to stop; its exit code and what it printed. */
async function stopped(name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (must(['inspect', '-f', '{{.State.Running}}', name]) === 'false') break
    await sleep(500)
  }
  return {
    running: must(['inspect', '-f', '{{.State.Running}}', name]) === 'true',
    code: Number(must(['inspect', '-f', '{{.State.ExitCode}}', name])),
    output: docker(['logs', name]).output,
  }
}

const record = {
  gate: 'container',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  passed: false,
  error: null,
  docker: null,
  image: null,
  measured: {},
  planned: [...CHECKS],
  checks: [],
}

/** Makes check `name`: passed when `body` returns, failed with what it threw. */
async function check(name, body) {
  if (!CHECKS.includes(name)) throw new Error(`${name} is not a check this gate plans`)
  console.log(`container gate: ${name}`)
  let timer
  const deadline = new Promise((_done, fail) => {
    timer = setTimeout(() => fail(new Error(`it did not finish within ${String(CHECK_MS / 1000)} s`)), CHECK_MS)
  })
  try {
    const said = await Promise.race([body(), deadline])
    record.checks.push({ name, passed: true, said: typeof said === 'string' ? said : null })
  } catch (error) {
    record.checks.push({ name, passed: false, said: String(error?.message ?? error) })
  } finally {
    clearTimeout(timer)
  }
}

const expect = (truth, otherwise) => {
  if (!truth) throw new Error(otherwise)
}

async function gate() {
  record.docker = must(['version', '--format', '{{.Server.Version}} {{.Server.Os}}/{{.Server.Arch}}'])
  const building = Date.now()
  must(['build', '-f', 'packages/report-server/Dockerfile', '-t', image, repo])
  record.measured.buildMs = Date.now() - building
  record.image = {
    tag: image,
    id: must(['image', 'inspect', '--format', '{{.Id}}', image]),
    size: Number(must(['image', 'inspect', '--format', '{{.Size}}', image])),
    node: must(['run', '--rm', '--entrypoint', 'node', image, '--version']),
    user: must(['run', '--rm', '--entrypoint', 'id', image, '-un']),
  }

  await check('unconfigured, it stops and names every setting it needs', () => {
    const ran = docker(['run', '--rm', image])
    expect(!/ERR_MODULE_NOT_FOUND|Cannot find module/.test(ran.output), `the image is missing a module at run time: ${ran.output.trim()}`)
    expect(ran.status !== 0, 'an unconfigured server exited 0')
    for (const setting of ['FORMANCY_REPORT_ISSUER', 'FORMANCY_REPORT_AUDIENCE', 'FORMANCY_REPORT_IDENTITY_SECRET', 'FORMANCY_REPORT_ATTRIBUTES'])
      expect(ran.output.includes(setting), `an unconfigured server did not name ${setting}: ${ran.output.trim()}`)
    return `exit ${String(ran.status)}`
  })

  // main.ts's second refusal: settings that read, and a server that cannot
  // open them -- here the secret's variable, unset. It prints the one
  // sentence and exits 1; were it thrown, Node would print the stack.
  await check('a secret reference it cannot resolve stops it, exit 1, with one sentence and no stack trace', async () => {
    const { HOST_SECRET: _unset, ...unresolved } = CONFIGURED
    const ended = await stopped(start('secret-unset', unresolved, { publish: false }))
    expect(!ended.running && ended.code === 1, `the server was still running after 30 s, or exited ${String(ended.code)}`)
    expect(!/^\s+at /m.test(ended.output), `the server printed a stack trace: ${ended.output.trim().slice(0, 400)}`)
    const said = 'the environment variable HOST_SECRET is unset or empty'
    expect(ended.output.trim() === said, `the server stopped saying otherwise than "${said}": ${ended.output.trim().slice(0, 400)}`)
    return said
  })

  const name = start('configured', CONFIGURED)
  record.measured.healthyMs = await healthy(name)
  const url = at(name)
  const answers = []
  const ask = async (path, headers = {}) => {
    const answer = await request(`${url}${path}`, { headers })
    const body = await answer.text()
    answers.push(answer)
    return { status: answer.status, headers: answer.headers, body }
  }

  await check('configured, it answers /health', async () => {
    const answer = await ask('/health')
    expect(answer.status === 200 && answer.body === '{"status":"ok"}', `/health answered ${String(answer.status)} ${answer.body}`)
    return `healthy after ${String(record.measured.healthyMs)} ms`
  })
  const unauthenticated = '{"code":"unauthenticated","message":"A valid host token is required."}'
  await check('whoami without a token is the one 401', async () => {
    const answer = await ask('/v1/whoami')
    expect(
      answer.status === 401 && answer.body === unauthenticated && answer.headers.get('www-authenticate') === 'Bearer',
      `whoami without a token answered ${String(answer.status)} ${answer.body}`,
    )
  })
  await check('whoami answers a token the host signed, with its tenant and the actions its roles give', async () => {
    const answer = await ask('/v1/whoami', { authorization: `Bearer ${tokens.good}` })
    const me = JSON.parse(answer.body)
    expect(
      answer.status === 200 &&
        me.tenant === 'acme' &&
        me.subject === 'u-1' &&
        JSON.stringify(me.capacities) === '["author"]' &&
        me.actions.includes('draft.save') &&
        !me.actions.includes('version.publish'),
      `whoami answered ${String(answer.status)} ${answer.body}`,
    )
    return `${String(me.actions.length)} actions`
  })
  await check('a forgery and a token without its tenant are the same 401', async () => {
    for (const presented of [tokens.forged, tokens.tenantless]) {
      const answer = await ask('/v1/whoami', { authorization: `Bearer ${presented}` })
      expect(answer.status === 401 && answer.body === unauthenticated, `whoami with a bad token answered ${String(answer.status)} ${answer.body}`)
    }
  })
  await check('nothing else answers, with a 404 that quotes nothing', async () => {
    for (const path of ['/v1/templates', '/v1/whoami/extra', '/v2/whoami']) {
      const answer = await ask(path, { authorization: `Bearer ${tokens.good}` })
      expect(
        answer.status === 404 && answer.body === '{"code":"not-found","message":"Nothing answers this request."}',
        `${path} answered ${String(answer.status)} ${answer.body}`,
      )
    }
  })
  await check('every answer says Cache-Control: no-store', () => {
    const without = answers.filter((answer) => answer.headers.get('cache-control') !== 'no-store')
    expect(answers.length > 0 && without.length === 0, `${String(without.length)} of ${String(answers.length)} answers carried no Cache-Control: no-store`)
    return `${String(answers.length)} answers`
  })
  await check('it runs as node', () => {
    const user = must(['exec', name, 'id', '-un'])
    expect(user === 'node', `the server runs as ${user}`)
  })
  await check('it carries the repository’s LICENSE.md and NOTICE', () => {
    for (const file of ['LICENSE.md', 'NOTICE']) {
      const inside = must(['exec', name, 'sha256sum', `/app/${file}`]).split(/\s+/)[0]
      const here = createHash('sha256')
        .update(readFileSync(join(repo, file)))
        .digest('hex')
      expect(inside === here, `/app/${file} is not the repository's ${file}`)
    }
  })
  await check('it can write its store directory', () => {
    must(['exec', name, 'sh', '-c', 'test -w /var/lib/formancy-report && touch /var/lib/formancy-report/.gate && rm /var/lib/formancy-report/.gate'])
  })
  await check('it cannot write its own code', () => {
    // As the user the server runs as: every path of its tree it could write, asked of each with BusyBox's
    // `[ -w ]`, since its find has no -writable; and a file it could add beside main.mjs.
    const writable = must([
      'exec',
      name,
      'sh',
      '-c',
      'find /app | while IFS= read -r path; do [ -w "$path" ] && echo "$path"; done | head -n 20; touch /app/dist/.gate 2>/dev/null && echo /app/dist/.gate; exit 0',
    ])
    expect(writable === '', `the server can write its own code: ${writable.split('\n').slice(0, 5).join(', ')}`)
  })
  await check('its log holds one audit line per request whoami answered, and no token', () => {
    const lines = docker(['logs', name])
      .output.split('\n')
      .filter((line) => line.startsWith('{'))
    const audited = lines.map((line) => JSON.parse(line)).filter((line) => line.msg === 'audit')
    const asked = 4 // whoami: no token, a good one, a forgery, no tenant
    expect(audited.length === asked, `the log holds ${String(audited.length)} audit lines for ${String(asked)} requests whoami answered`)
    expect(
      audited.every((line) => line.audit.tenant === null && line.audit.actor === null),
      'an audit line named who asked without an audit key',
    )
    const log = lines.join('\n')
    for (const presented of Object.values(tokens))
      for (const part of [presented, ...presented.split('.')]) expect(!log.includes(part), 'a token, or a part of one, reached the log')
    expect(!log.includes('acme') && !log.includes('"u-1"'), 'a claim’s value reached the log')
    return `${String(audited.length)} audit lines`
  })
  await check('SIGHUP leaves a server with one key running', async () => {
    must(['kill', '--signal', 'SIGHUP', name])
    await sleep(1000) // a choice (above)
    expect(must(['inspect', '-f', '{{.State.Running}}', name]) === 'true', 'the server stopped on SIGHUP')
    expect(docker(['logs', name]).output.includes('nothing was read again'), 'the server did not say SIGHUP read nothing')
    expect((await request(`${url}/health`)).ok, 'the server stopped answering after SIGHUP')
  })
  await check('SIGTERM stops it, exit 0', () => {
    const from = Date.now()
    must(['stop', '--time', '10', name]) // Docker's own default (above)
    record.measured.stopMs = Date.now() - from
    const code = Number(must(['inspect', '-f', '{{.State.ExitCode}}', name]))
    expect(code === 0, `it exited ${String(code)} on SIGTERM`)
    return `stopped in ${String(record.measured.stopMs)} ms`
  })

  // Nothing it runs writes its root file system: an operator may run it
  // with --read-only, and mount the store's directory as a volume.
  await check('it runs on a read-only root file system', async () => {
    const sealed = start('read-only', CONFIGURED, { flags: ['--read-only'] })
    await healthy(sealed)
    const answer = await request(`${at(sealed)}/v1/whoami`, { headers: { authorization: `Bearer ${tokens.good}` } })
    expect(answer.status === 200, `whoami on a read-only root answered ${String(answer.status)}`)
    expect(docker(['exec', sealed, 'touch', '/app/.gate']).status !== 0, 'the root file system was writable under --read-only')
  })

  // main.ts's key set arm: the serving line names the kids in force, and
  // SIGHUP reads the file again, as an operator rotates a key -- a token
  // under the added kid refused before and answered after.
  await check('with a key set file, it names the kids it serves under, and SIGHUP reads the file again', async () => {
    const keys = { 'gate-1': randomBytes(32), 'gate-2': randomBytes(32) }
    const set = (...kids) => JSON.stringify({ keys: kids.map((kid) => ({ kty: 'oct', kid, alg: 'HS256', k: keys[kid].toString('base64url') })) })
    const here = mkdtempSync(join(tmpdir(), 'formancy-report-gate-'))
    try {
      const file = join(here, 'identity-keys.json')
      const inside = '/tmp/identity-keys.json'
      writeFileSync(file, set('gate-1'))
      const { FORMANCY_REPORT_IDENTITY_SECRET: _reference, HOST_SECRET: _secret, ...rest } = CONFIGURED
      const keyed = start(
        'key-set',
        { ...rest, FORMANCY_REPORT_IDENTITY_KEYS_FILE: inside, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' },
        { files: { [inside]: file } },
      )
      await healthy(keyed)
      const serving = logLines(keyed).find((line) => line.msg === 'serving')
      expect(
        JSON.stringify(serving?.identityKeys) === '{"kids":["gate-1"],"leftOut":[]}',
        `the serving line named the key set as ${JSON.stringify(serving?.identityKeys ?? null)}`,
      )
      const asked = async () => {
        const statuses = []
        for (const kid of ['gate-1', 'gate-2'])
          statuses.push((await request(`${at(keyed)}/v1/whoami`, { headers: { authorization: `Bearer ${sign(claims, keys[kid], kid)}` } })).status)
        return statuses.join(' ')
      }
      const before = await asked()
      expect(before === '200 401', `before SIGHUP, tokens under gate-1 and gate-2 answered ${before}`)
      writeFileSync(file, set('gate-1', 'gate-2'))
      must(['cp', file, `${keyed}:${inside}`])
      must(['kill', '--signal', 'SIGHUP', keyed])
      await sleep(1000) // a choice (above)
      const read = logLines(keyed).find((line) => line.msg === 'identity keys read again')
      expect(
        JSON.stringify(read?.identityKeys?.added) === '["gate-2"]',
        `SIGHUP did not log the key set read again with gate-2 added: ${JSON.stringify(read ?? null)}`,
      )
      const after = await asked()
      expect(after === '200 200', `after SIGHUP, tokens under gate-1 and gate-2 answered ${after}`)
      return 'gate-1, then gate-1 and gate-2'
    } finally {
      rmSync(here, { recursive: true, force: true })
    }
  })

  // The public settings: only the running image shows main.ts reads them.
  await check('FORMANCY_REPORT_RATE_LIMIT=2 answers 401 401 429', async () => {
    const limited = start('limited', { ...CONFIGURED, FORMANCY_REPORT_RATE_LIMIT: '2' })
    await healthy(limited)
    const statuses = []
    for (let n = 0; n < 3; n += 1) statuses.push((await request(`${at(limited)}/v1/whoami`)).status)
    expect(statuses.join(' ') === '401 401 429', `three requests answered ${statuses.join(' ')}`)
  })
  const refusesSetting = async (label, env, says) => {
    const stopping = start(label, { ...CONFIGURED, ...env }, { publish: false })
    const ended = await stopped(stopping)
    expect(!ended.running && ended.code !== 0, `the server was still running after 30 s, or exited 0`)
    expect(ended.output.includes(says), `the server stopped without naming the setting: ${ended.output.trim().slice(0, 400)}`)
  }
  await check('FORMANCY_REPORT_RATE_LIMIT=abc stops it, naming the setting', () =>
    refusesSetting('rate-abc', { FORMANCY_REPORT_RATE_LIMIT: 'abc' }, 'FORMANCY_REPORT_RATE_LIMIT is a whole number'),
  )
  await check('FORMANCY_REPORT_TRUSTED_PROXIES splits the limit by the address a named proxy forwards', async () => {
    // Asked from inside the container, so the peer is 127.0.0.1 on every runner, whatever Docker's port forwarding makes of a request from the host.
    const proxied = start('proxied', { ...CONFIGURED, FORMANCY_REPORT_RATE_LIMIT: '2', FORMANCY_REPORT_TRUSTED_PROXIES: '127.0.0.1' })
    await healthy(proxied)
    const script =
      "const from=['198.51.100.7','198.51.100.7','198.51.100.7','198.51.100.8'];const seen=[];for(const address of from)seen.push((await fetch('http://127.0.0.1:4392/v1/whoami',{headers:{'x-forwarded-for':address}})).status);console.log(seen.join(' '))"
    const statuses = must(['exec', proxied, 'node', '--input-type=module', '-e', script])
    expect(statuses === '401 401 429 401', `three requests forwarded for one address and one for another answered ${statuses}`)
  })
  await check('FORMANCY_REPORT_TRUSTED_PROXIES=true stops it, naming the setting', () =>
    refusesSetting('proxies-true', { FORMANCY_REPORT_TRUSTED_PROXIES: 'true' }, 'FORMANCY_REPORT_TRUSTED_PROXIES: entry 1 trusts every peer'),
  )
  await check('FORMANCY_REPORT_CORS_ORIGINS grants a listed origin’s preflight and refuses another', async () => {
    const crossing = start('origins', { ...CONFIGURED, FORMANCY_REPORT_CORS_ORIGINS: 'https://app.example' })
    await healthy(crossing)
    const preflight = (origin) =>
      request(`${at(crossing)}/v1/whoami`, {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' },
      })
    const granted = await preflight('https://app.example')
    const refused = await preflight('https://evil.example')
    expect(
      granted.status === 204 && granted.headers.get('access-control-allow-origin') === 'https://app.example',
      `a listed origin's preflight answered ${String(granted.status)}`,
    )
    expect(
      refused.status === 403 && refused.headers.get('access-control-allow-origin') === null,
      `another origin's preflight answered ${String(refused.status)}`,
    )
  })

  const made = new Set(record.checks.map((entry) => entry.name))
  const unmade = CHECKS.filter((each) => !made.has(each))
  const failed = record.checks.filter((entry) => !entry.passed)
  if (unmade.length > 0 || failed.length > 0)
    throw new Error([...failed.map((entry) => `${entry.name}: ${String(entry.said)}`), ...unmade.map((each) => `${each}: not made`)].join('\n'))
}

// `node scripts/container.mjs …`; imported, it only names its checks and its base image.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/container.mjs')) {
  let failure
  try {
    await gate()
    record.passed = true
    console.log(
      `container gate passed: ${String(record.checks.length)} checks on ${image} (${String(record.image?.node)}, ${String(Math.round((record.image?.size ?? 0) / 1e6))} MB), built in ${String(Math.round((record.measured.buildMs ?? 0) / 1000))} s`,
    )
  } catch (error) {
    failure = error
    record.error = String(error?.message ?? error)
    console.error(`container gate FAILED\n${record.error}`)
  } finally {
    for (const name of started) docker(['rm', '-f', name])
    if (removeImage) docker(['image', 'rm', '-f', image])
    record.finishedAt = new Date().toISOString()
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  }
  process.exit(failure === undefined ? 0 : 1)
}
