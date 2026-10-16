/**
 * dom-accessibility-api 0.5 ships its declarations, but its `exports` map
 * names no `types`, so TypeScript's resolution reaches its `.mjs` and finds
 * none -- as in the builders' suites. What parity.test.tsx uses, as that
 * package's own `dist/index.d.ts` declares it.
 */
declare module 'dom-accessibility-api' {
  export interface ComputeTextAlternativeOptions {
    readonly computedStyleSupportsPseudoElements?: boolean
    readonly getComputedStyle?: (element: Element, pseudoElement?: string) => CSSStyleDeclaration
  }
  export function computeAccessibleName(root: Element, options?: ComputeTextAlternativeOptions): string
  export function computeAccessibleDescription(root: Element, options?: ComputeTextAlternativeOptions): string
  export function getRole(element: Element): string | null
}
