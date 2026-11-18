export { renderDocx } from './render.js'
export {
  MAX_DOCX_CHARACTERS,
  MAX_DOCX_FAMILY_LENGTH,
  MAX_DOCX_IMAGE_DATA,
  MAX_DOCX_MEDIA_BYTES,
  MAX_DOCX_PARAGRAPHS,
  MAX_DOCX_PICTURES,
  MAX_DOCX_RUNS,
} from './limits.js'
/** The runtime's refusal and its codes, handed on so that a caller of the writer catches what it throws without depending on the runtime itself. */
export { REFUSAL_CODES, RenderRefusal } from '@formancy/report-runtime'
export type { RefusalCode, ResolvedDocument } from '@formancy/report-runtime'
