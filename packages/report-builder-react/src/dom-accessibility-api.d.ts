/**
 * dom-accessibility-api 0.5 ships its declarations, but its `exports` map
 * names no `types`, so TypeScript's NodeNext resolution reaches its `.mjs`
 * and finds none. The two functions the tests use, as that package's own
 * `dist/index.d.ts` declares them.
 */
declare module 'dom-accessibility-api' {
  export function computeAccessibleName(root: Element): string
  export function computeAccessibleDescription(root: Element): string
}
