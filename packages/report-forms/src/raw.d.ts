/**
 * A file the test runner reads as text, with Vite's `?raw` suffix. Only the
 * mapping's test reads one, this package's README, whose table it holds to
 * what the bridge reads; nothing published does, and this package's
 * TypeScript has no file-system API to read one with.
 */
declare module '*?raw' {
  const text: string
  export default text
}
