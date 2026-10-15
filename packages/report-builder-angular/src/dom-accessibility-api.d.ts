/**
 * Types for `dom-accessibility-api`, which ships declarations without
 * advertising them: no `types` field, and no `types` condition in its
 * `exports`, so TypeScript resolves the import to JavaScript and gives up.
 *
 * Test-only: it is a devDependency, and Testing Library's own. The tests
 * compute an accessible description with it, the one thing a scenario's
 * `invalid` step asks that Testing Library's queries do not answer.
 */
declare module 'dom-accessibility-api' {
  export function computeAccessibleName(element: Element): string
  export function computeAccessibleDescription(element: Element): string
}
