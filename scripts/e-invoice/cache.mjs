// The e-invoice gate's tools, fetched by exact version and checked against
// their registered SHA-256 (0027). Everything is under one directory,
// `.e-invoice-cache/` by default, which .gitignore names: nothing
// downloaded is ever committed.
//
//   <id>/<version>/<asset>      each tool, as docs/release/e-invoice-tools.json pins it
//   <id>/<version>/unpacked/    the configuration, unpacked again from its verified bytes on every run
//
// CI restores the directory from a cache keyed on the register, outside a
// release; a file restored is used only once its bytes hash to the pin.

import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** Where each tool lives under `cache`: its asset under its own name, and where it is unpacked. */
export function layout(cache) {
  return {
    file: (tool) => join(cache, tool.id, tool.version, new URL(tool.url).pathname.split('/').pop()),
    unpacked: (tool) => join(cache, tool.id, tool.version, 'unpacked'),
  }
}

/** The SHA-256 of a file, read as a stream. */
export async function sha256File(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/**
 * `path`, holding the bytes whose SHA-256 is `sha256`: the file already
 * there when it holds them, else what `url` serves, written beside it and
 * moved into place only once its hash is the registered one. Refuses,
 * deleting what it fetched, when it is not; a cached file that is not those
 * bytes is deleted and fetched again. Returns whether it fetched.
 */
export async function fetchVerified({ url, path, sha256 }, { fetch = globalThis.fetch } = {}) {
  if (existsSync(path)) {
    if ((await sha256File(path)) === sha256) return false
    rmSync(path)
  }
  mkdirSync(dirname(path), { recursive: true })
  const part = `${path}.part`
  const response = await fetch(url, { redirect: 'follow' })
  // What a server sent -- its status, the hash of its bytes -- is printed
  // and never carried in the error: the error reaches the gate's results
  // file, and nothing a server sends is written there.
  if (!response.ok || response.body === null) {
    console.error(`${url} answered ${String(response.status)}`)
    throw new Error(`${url} did not serve the file`)
  }
  const hash = createHash('sha256')
  const body = Readable.fromWeb(response.body)
  body.on('data', (chunk) => hash.update(chunk))
  await pipeline(body, createWriteStream(part))
  const got = hash.digest('hex')
  if (got !== sha256) {
    rmSync(part, { force: true })
    console.error(`${url} served bytes whose SHA-256 is ${got}`)
    throw new Error(`refused what ${url} served: its SHA-256 is not ${sha256}, the one the register says`)
  }
  renameSync(part, path)
  return true
}

/** The bytes at `path`, hashed as they are read: refused unless they are the registered ones. */
export function readVerified(path, sha256) {
  const bytes = readFileSync(path)
  const got = createHash('sha256').update(bytes).digest('hex')
  if (got !== sha256) throw new Error(`refused to read ${path}: its SHA-256 is ${got}, where the register says ${sha256}`)
  return bytes
}
