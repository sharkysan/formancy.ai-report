/**
 * The bin's settings, as the composition root reads them once from the
 * environment it was started with (main.ts), parsed here so that every
 * rule and every refusal is tested without starting a process (0088):
 * Report's server, and the person's token at their host, both or neither.
 * Nothing here looks up the environment or a file: both are handed in.
 *
 * The token is the person's, as their host's identity provider issues it,
 * and this package mints, refreshes and writes none: the setting names
 * where it is, `env:NAME` or `file:/absolute/path`, as report-server's own
 * secret references do, and a file is read again before every request, so
 * that a host's own tool can write the next token there before the last
 * one expires. No sentence repeats a value, a token's or an address's: the
 * commonest mistake is a token pasted where its reference goes, and a URL
 * may carry a password.
 */
import { posix, sep } from 'node:path'
import { createReportClient, isBearerToken } from '@formancy/report-client'
import type { ReportClient } from '@formancy/report-client'

/** Every setting the bin reads, with what it is for: both, or neither. */
export const SETTINGS = Object.freeze({
  FORMANCY_REPORT_URL: 'Report’s server’s base URL, http: or https:, with no credentials, query, fragment or trailing slash',
  FORMANCY_REPORT_TOKEN:
    'a secret reference to the person’s token at their host: env:NAME, read once when the bin starts, or file:/absolute/path -- on Windows a drive’s or a share’s -- read again before each request to the server',
})

/** The setting that names the server, and the one that names the token, each checked to be a key of SETTINGS. */
export const URL_SETTING = 'FORMANCY_REPORT_URL' satisfies keyof typeof SETTINGS
export const TOKEN_SETTING = 'FORMANCY_REPORT_TOKEN' satisfies keyof typeof SETTINGS

/** The environment the bin was started with, as Node gives it. */
export type Environment = Readonly<Record<string, string | undefined>>

/** A file's text, read as UTF-8: Node's `readFile`, handed in by main.ts. */
export type ReadFile = (path: string) => Promise<string>

/** What the settings say: the client of Report's server the tools that need it ask, none where neither is set, or every reason the bin does not start. */
export type SettingsReading = { readonly ok: true; readonly client?: ReportClient } | { readonly ok: false; readonly problems: readonly string[] }

/** A variable's name, as report-server's secret references take one. */
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/

/** The prefix of this bin's own settings, and of report-server's: a variable under it holds a setting, never a token. */
const PREFIX = 'FORMANCY_REPORT_'

/** What a bearer token is, as report-client holds one to it. */
const BEARER_SAID = 'letters, digits and - . _ ~ + /, with = only at its end, on one line'

/** Why a token file gave no token, said without its path or anything it held. */
const TOKEN_FILE_UNREAD = `The file ${TOKEN_SETTING} names could not be read: the host’s own tool writes the person’s token there`
const TOKEN_FILE_EMPTY = `The file ${TOKEN_SETTING} names is empty: the host’s own tool writes the person’s token there`
const TOKEN_FILE_NO_BEARER = `The file ${TOKEN_SETTING} names holds no bearer token: ${BEARER_SAID}`

/**
 * A token the bin's settings could not give, thrown by the token function
 * before report-client sends anything: so the tool that asked can say that
 * nothing was sent, where a request that went out with no answer is not
 * known to have been written.
 */
export class TokenUnavailable extends Error {}

/**
 * Whether `path` names one file wherever the bin runs, which a token's
 * file must, since it is read again before every request: absolute on a
 * POSIX system; on Windows, from a drive and its root, `C:\`, or a share,
 * `\\server\share` -- not from the root alone, `\token`, which Node
 * calls absolute and reads from whichever drive the bin runs on, nor from
 * a drive alone, `C:token`, relative to that drive's current directory.
 */
export function isFilePath(path: string, windows = sep === '\\'): boolean {
  return windows ? /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/])/.test(path) : posix.isAbsolute(path)
}

/**
 * The token `reference` names, as report-client asks for it before every
 * request -- a variable's value, read now and once, or a file's text, read
 * again each time it is asked for, its one line ending taken off -- or why
 * the reference is refused.
 */
function tokenOf(reference: string, env: Environment, readFile: ReadFile): (() => string | Promise<string>) | string {
  if (reference.startsWith('env:')) {
    // What follows env: is named in no sentence: a token pasted there in capitals is a name to ENV_NAME.
    const name = reference.slice('env:'.length)
    if (!ENV_NAME.test(name)) return `${TOKEN_SETTING} names a variable as env:NAME, its name in upper case, digits and underscores.`
    if (name.startsWith(PREFIX))
      return `${TOKEN_SETTING} names a variable under ${PREFIX}, which holds a setting and never a token: put the token in a variable outside it, such as HOST_TOKEN, or in a file, and name that.`
    const value = env[name]
    if (value === undefined || value === '') return `${TOKEN_SETTING} names a variable that is unset or empty.`
    // Read once, so a token no request could carry is refused now rather than at every request.
    if (!isBearerToken(value)) return `${TOKEN_SETTING} names a variable that holds no bearer token: ${BEARER_SAID}.`
    return () => value
  }
  if (reference.startsWith('file:')) {
    const path = reference.slice('file:'.length)
    if (!isFilePath(path))
      return `${TOKEN_SETTING} names a file by its absolute path, file:/absolute/path, on Windows from a drive or a share: it is read again before each request, from wherever the bin then runs.`
    return async () => {
      let text: string
      try {
        text = await readFile(path)
      } catch {
        // Node's own error names the path, and a reader of the agent's answer need not.
        throw new TokenUnavailable(TOKEN_FILE_UNREAD)
      }
      const token = text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text
      if (token === '') throw new TokenUnavailable(TOKEN_FILE_EMPTY)
      if (!isBearerToken(token)) throw new TokenUnavailable(TOKEN_FILE_NO_BEARER)
      return token
    }
  }
  return `${TOKEN_SETTING} is a secret reference, env:NAME or file:/absolute/path, and never the token itself: put the token in a variable or a file, and name that.`
}

/**
 * The bin's settings from `env`: neither, and the tools that need no
 * server are the bin's only ones; both, and a client of the server they
 * name, as the person whose token the reference names; or every reason
 * the bin does not start. A variable set to the empty string is an unset
 * one, as a client's configuration may hand over one it was not given.
 */
export function readSettings(env: Environment, readFile: ReadFile): SettingsReading {
  const value = (name: keyof typeof SETTINGS): string | undefined => (env[name] === '' ? undefined : env[name])
  const url = value(URL_SETTING)
  const reference = value(TOKEN_SETTING)
  if (url === undefined && reference === undefined) return { ok: true }
  if (url === undefined || reference === undefined) {
    // Half-configured is the state worth refusing (formancy's main.ts): a
    // server with no token is refused every request, and a token with no
    // server is asked of nothing; both read as the tools being broken.
    return {
      ok: false,
      problems: [
        `Set ${URL_SETTING} and ${TOKEN_SETTING} together, or neither: ${url === undefined ? TOKEN_SETTING : URL_SETTING} is set alone. With neither, the tools that need no server are the bin’s only ones.`,
      ],
    }
  }
  const token = tokenOf(reference, env, readFile)
  if (typeof token === 'string') return { ok: false, problems: [token] }
  try {
    // report-client's rule of a base URL, the one there is, said in its own sentence, which quotes no URL.
    return { ok: true, client: createReportClient({ server: url, token }) }
  } catch (error) {
    return { ok: false, problems: [`${URL_SETTING} is refused by report-client: ${(error as Error).message}`] }
  }
}
