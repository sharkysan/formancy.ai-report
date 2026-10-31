import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { baseImage, CHECKS } from './container.mjs'
import { authorClaims } from './container/host.mjs'

/**
 * The container gate (0046) without Docker: what it leaves behind when it
 * cannot run, and what the report holds its record to. The gate itself runs
 * in gates.yml's container job and, by hand, wherever Docker is.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const made = mkdtempSync(join(tmpdir(), 'container-gate-'))
afterAll(() => rmSync(made, { recursive: true, force: true }))

describe('the container gate', () => {
  // The report reads the gate's record and nothing else of the job; a gate
  // that left none when Docker was missing would be a job that looks as
  // though it had nothing to say. It fails, and says so, in its record.
  test('writes its record, and fails, when it cannot run Docker', () => {
    const out = join(made, 'container.json')
    const ran = spawnSync(process.execPath, [join(repo, 'scripts', 'container.mjs'), '--docker', join(made, 'no-such-docker'), '--out', out], {
      encoding: 'utf8',
    })
    expect(ran.status).toBe(1)
    const record = JSON.parse(readFileSync(out, 'utf8'))
    expect(record).toMatchObject({ gate: 'container', passed: false, image: null, checks: [], planned: CHECKS })
    expect(record.error).toMatch(/^docker version /)
    expect(Date.parse(record.finishedAt)).toBeGreaterThanOrEqual(Date.parse(record.startedAt))
  })

  // Imported, the script makes nothing: the report reads its checks and its
  // base from it, and must not start a build to do so.
  test('names its checks and its base image when imported, and runs nothing', () => {
    expect(CHECKS.length).toBeGreaterThan(10)
    expect(new Set(CHECKS).size).toBe(CHECKS.length)
    expect(baseImage()).toMatch(/^node:26\.\d+\.\d+-alpine[\d.]+@sha256:[0-9a-f]{64}$/)
  })

  // A token signed when the script loads starts its lifetime before the
  // image's build, which comes first and is unmeasured on a runner, and the
  // draft checks come late: a slow build would fail them for an expired
  // token rather than for anything the image does. The claims are issued
  // when a check asks for them, so one asked the moment an earlier one has
  // expired is issued then, for the same lifetime.
  test('issues an author’s claims when a check asks for them, not when it is imported', () => {
    vi.useFakeTimers()
    try {
      const first = authorClaims()
      vi.setSystemTime((first.exp + 1) * 1000)
      const later = authorClaims()
      expect(later.iat).toBe(first.exp + 1)
      expect(later.exp - later.iat).toBe(first.exp - first.iat)
      expect(later).toMatchObject({ sub: first.sub, tid: first.tid, roles: first.roles })
    } finally {
      vi.useRealTimers()
    }
  })

  // The draft slice (0049) is held by the image, not only by the server's
  // suite: a store that cannot outlive its container, or cannot be written
  // on a read-only root, passes every test in the workspace. The gate must
  // plan these three, or the release report would count a gate that never
  // restarted a container as one that did.
  test('plans the draft slice’s three checks, restart, image and read-only root', () => {
    expect(CHECKS).toEqual(
      expect.arrayContaining([
        'a draft an author saves is read back after the container restarts on the same volume',
        'an image an author keeps is read back by its digest',
        'on a read-only root, it saves a draft into its store',
      ]),
    )
  })
})
