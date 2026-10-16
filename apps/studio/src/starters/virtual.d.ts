/** The module `plugin.ts` serves: the corpus's starters, encoded for the page (`codec.ts`). */
declare module 'virtual:formancy-report-starters' {
  const encoded: import('./codec.js').EncodedStarters
  export default encoded
}
