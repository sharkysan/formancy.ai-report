/**
 * A file the test runner reads as text, with Vite's `?raw` suffix. Only the
 * stylesheet's test reads one; nothing published does, and this package's
 * TypeScript has no file-system API to read one with.
 */
declare module '*?raw' {
  const text: string
  export default text
}
