import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { fetchVerified, layout, readVerified, sha256File } from './cache.mjs'

/**
 * A download is untrusted data (0027): each tool is written into place only
 * once its hash is the registered one, and read again, hashed, where it is
 * used. Proved with a fetch that serves bytes from memory, so no case
 * reaches the network.
 */
const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})
const scratch = () => {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'e-invoice-cache-')))
  made.push(directory)
  return directory
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** A fetch that answers every call with `status` and `bytes`, as a server sends an error page with its 404, counting the calls. */
function serving(bytes, status = 200) {
  const calls = []
  const fetch = async (url) => {
    calls.push(url)
    return new Response(bytes, { status })
  }
  return { fetch, calls }
}

const BYTES = Buffer.from('a JAR, as registered')

describe('the cache’s layout', () => {
  // One directory per tool and version, the file under its asset's own
  // name: two versions of a tool never share a path, so a pin moved never
  // reads the bytes of the one before it.
  test('keeps each tool’s version apart, under its asset’s name', () => {
    const where = layout('/cache')
    const tool = { id: 'kosit', version: '1.6.3', url: 'https://github.com/itplr-kosit/validator/releases/download/v1.6.3/validator-1.6.3-standalone.jar' }
    expect(where.file(tool).replaceAll('\\', '/')).toBe('/cache/kosit/1.6.3/validator-1.6.3-standalone.jar')
    expect(where.unpacked(tool).replaceAll('\\', '/')).toBe('/cache/kosit/1.6.3/unpacked')
  })
})

describe('fetchVerified', () => {
  // The ordinary case: fetched, checked and moved into place.
  test('fetches, checks and keeps what matches the registered hash', async () => {
    const path = join(scratch(), 'mustang', '2.26.0', 'Mustang-CLI-2.26.0.jar')
    const { fetch, calls } = serving(BYTES)
    expect(await fetchVerified({ url: 'https://example.org/m.jar', path, sha256: sha(BYTES) }, { fetch })).toBe(true)
    expect(readFileSync(path).equals(BYTES)).toBe(true)
    expect(calls).toEqual(['https://example.org/m.jar'])
  })

  // The failure this exists for: bytes other than the registered ones are
  // refused before anything runs them, and nothing of them is left where a
  // later run would find it. What was served is printed, never carried in
  // the error, which reaches the gate's results.
  test('refuses, and leaves nothing, when the bytes served are not the registered ones', async () => {
    const directory = scratch()
    const path = join(directory, 'm.jar')
    const printed = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchVerified({ url: 'https://example.org/m.jar', path, sha256: sha(Buffer.from('other')) }, serving(BYTES))).rejects.toThrow(
      /^refused what https:\/\/example.org\/m.jar served: its SHA-256 is not [0-9a-f]{64}, the one the register says$/,
    )
    expect(printed).toHaveBeenCalledWith(`https://example.org/m.jar served bytes whose SHA-256 is ${sha(BYTES)}`)
    printed.mockRestore()
    expect(readdirSync(directory)).toEqual([])
  })

  // A file already in the cache -- CI restores one keyed on the register --
  // is used only when it is still those bytes; one that is not is fetched
  // again, and a server that fails says so.
  test('reuses a cached file that matches, fetches again one that does not, and refuses a failed answer', async () => {
    const path = join(scratch(), 'm.jar')
    writeFileSync(path, BYTES)
    const unused = serving(BYTES)
    expect(await fetchVerified({ url: 'https://example.org/m.jar', path, sha256: sha(BYTES) }, unused)).toBe(false)
    expect(unused.calls).toEqual([])
    writeFileSync(path, 'tampered')
    expect(await fetchVerified({ url: 'https://example.org/m.jar', path, sha256: sha(BYTES) }, serving(BYTES))).toBe(true)
    expect(await sha256File(path)).toBe(sha(BYTES))
    rmSync(path)
    const printed = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchVerified({ url: 'https://example.org/m.jar', path, sha256: sha(BYTES) }, serving(BYTES, 404))).rejects.toThrow(
      /^https:\/\/example.org\/m.jar did not serve the file$/,
    )
    expect(printed).toHaveBeenCalledWith('https://example.org/m.jar answered 404')
    printed.mockRestore()
  })
})

describe('readVerified', () => {
  // The bytes a judge or the unpacker reads are hashed where they are read,
  // not only where they were fetched: a file changed between the two is
  // refused, not used.
  test('answers the bytes when they are the registered ones, and refuses others', () => {
    const path = join(scratch(), 'c.zip')
    writeFileSync(path, BYTES)
    expect(readVerified(path, sha(BYTES)).equals(BYTES)).toBe(true)
    writeFileSync(path, 'changed since')
    expect(() => readVerified(path, sha(BYTES))).toThrow(
      `refused to read ${path}: its SHA-256 is ${sha(Buffer.from('changed since'))}, where the register says ${sha(BYTES)}`,
    )
  })
})
