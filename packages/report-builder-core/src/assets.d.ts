/**
 * A file the test runner reads as text, with Vite's `?raw` suffix, and the
 * files of a directory read so by `import.meta.glob`. Only the stylesheet's
 * test reads them; nothing published does, and this package's TypeScript
 * has no file-system API to read one with.
 */
declare module '*?raw' {
  const text: string
  export default text
}

interface ImportMeta {
  /** Vite's: every file `pattern` matches, by its path from the importer, each read as the options say. */
  glob<T>(pattern: string, options: { readonly query: '?raw'; readonly import: 'default'; readonly eager: true }): Record<string, T>
}
