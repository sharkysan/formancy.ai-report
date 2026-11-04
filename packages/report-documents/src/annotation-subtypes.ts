/**
 * The annotation subtypes ISO 32000 defines (ISO 32000-1 Table 169, with
 * ISO 32000-2's Projection and RichMedia): the only ones a refusal names,
 * in the reader's own spelling, and the only ones a viewer shows whatever
 * their Invisible flag says. A module of its own, which imports nothing,
 * so that the refusals every other module throws through name nothing
 * from a module above them.
 */
export const ANNOTATION_SUBTYPES = [
  'Text',
  'Link',
  'FreeText',
  'Line',
  'Square',
  'Circle',
  'Polygon',
  'PolyLine',
  'Highlight',
  'Underline',
  'Squiggly',
  'StrikeOut',
  'Stamp',
  'Caret',
  'Ink',
  'Popup',
  'FileAttachment',
  'Sound',
  'Movie',
  'Widget',
  'Screen',
  'PrinterMark',
  'TrapNet',
  'Watermark',
  '3D',
  'Redact',
  'Projection',
  'RichMedia',
] as const
export type AnnotationSubtype = (typeof ANNOTATION_SUBTYPES)[number]

const SUBTYPES: ReadonlySet<string> = new Set(ANNOTATION_SUBTYPES)

/** Whether `name`, as a name is held, is a subtype ISO 32000 defines. */
export const isAnnotationSubtype = (name: string): name is AnnotationSubtype => SUBTYPES.has(name)
