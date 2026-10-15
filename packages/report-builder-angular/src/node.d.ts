/**
 * The few Node functions dependencies.test.ts reads the installed tree with,
 * typed here because this package has no `@types/node`, on purpose: its
 * published code runs in a browser, where a Node type would compile and the
 * call would fail.
 *
 * Declared function by function, so nothing else of Node type-checks. A
 * published file that imported one of these anyway would not build --
 * ng-packagr compiles what the entry reaches, without this file -- and the
 * dependency test would name the module it does not declare.
 */
declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function realpathSync(path: string): string
}

declare module 'node:path' {
  export function dirname(path: string): string
  export function join(...paths: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}
