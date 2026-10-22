/**
 * What a report declares before it lays anything out: its page, its print
 * styles, the datasets and parameters it reads, the assets it shows and
 * where it came from. Each list records the ids it declares, so components
 * can be checked against them.
 */
import { ASSET_AND_FONT_MEDIA_TYPES } from './assets.js'
import type { AnyAssetMediaType, AssetRef } from './assets.js'
import type { Findings } from './check.js'
import { all, describe, fieldKey, flag, fontSize, identifier, integer, kindOf, matches, oneOf, optional, points, readArray, readObject, shape, strictKeys, text } from './check.js'
import { DATASET_ROLES, FIELD_TYPES, PARAMETER_TYPES } from './data.js'
import type { DatasetContract, DatasetRole, Datasets, FieldContract, FieldType, ParameterDef, ParameterType } from './data.js'
import { PROVENANCE_KINDS } from './definition.js'
import type { Provenance, ProvenanceKind } from './definition.js'
import { MAX_ASSETS, MAX_DATASET_FIELDS, MAX_LABEL_LENGTH, MAX_PARAMETERS, MAX_SCALE, MAX_STYLES, MIN_PRINTABLE_PT } from './limits.js'
import { ORIENTATIONS, PAGE_SIZE_NAMES, printableArea } from './page.js'
import type { Margins, PageSettings } from './page.js'
import { at } from './pointer.js'
import { ALIGNMENTS, FONT_FAMILIES } from './styles.js'
import type { PrintStyle } from './styles.js'
import { COLOR, DECIMAL, DIGEST, FORM_ID, INTEGER, isCalendarDate, SCHEMA_HASH } from './syntax.js'
import { declare } from './validate-context.js'
import type { Ctx, Declarations, Declaration } from './validate-context.js'
import { checkDatasetForms, checkFieldsBound, readDatasetForm, readFieldForm } from './validate-form-binding.js'
import type { DatasetForm } from './validate-form-binding.js'

function readMargins(f: Findings, value: unknown, path: string): Margins | undefined {
  const o = shape(f, value, path, ['top', 'right', 'bottom', 'left'])
  const [top, right, bottom, left] = (['top', 'right', 'bottom', 'left'] as const).map((side) => points(f, o?.[side], at(path, side), 'zero'))
  return top === undefined || right === undefined || bottom === undefined || left === undefined ? undefined : { top, right, bottom, left }
}

/** The page, recording what its margins leave when that is enough to measure content against. */
export function readPage(c: Ctx, value: unknown, path: string): PageSettings | undefined {
  const o = shape(c.f, value, path, ['size', 'orientation', 'margins'])
  const size = oneOf(c.f, o?.size, at(path, 'size'), PAGE_SIZE_NAMES)
  const orientation = oneOf(c.f, o?.orientation, at(path, 'orientation'), ORIENTATIONS)
  const margins = readMargins(c.f, o?.margins, at(path, 'margins'))
  if (size === undefined || orientation === undefined || margins === undefined) return undefined
  const page = { size, orientation, margins }
  const area = printableArea(page)
  if (area.width >= MIN_PRINTABLE_PT && area.height >= MIN_PRINTABLE_PT) c.printable = area
  else {
    c.f.report(
      at(path, 'margins'),
      'printable-area-too-small',
      `the margins leave ${area.width} x ${area.height} points of the page; at least ${MIN_PRINTABLE_PT} each way is needed`,
    )
  }
  return page
}

/** A declaration read: its id, what it declares, and the declaration itself when every part of it could be read. */
interface Read<T, D> {
  readonly entry: Declaration<D>
  readonly item: T | undefined
}

/** A list of declarations, each with an id unique in the list. */
function readDeclarations<T, D>(
  c: Ctx,
  value: unknown,
  path: string,
  max: number,
  what: string,
  read: (item: unknown, where: string) => Read<T, D>,
): { items: T[] | undefined; declared: Map<string, D> | undefined } {
  const items = readArray(c.f, value, path, max)
  if (items === undefined) return { items: undefined, declared: undefined }
  const entries = items.map((item, index) => read(item, at(path, index)))
  const declared = declare(
    c.f,
    entries.map(({ entry }) => entry),
    'duplicate-id',
    (id) => `another ${what} is already ${id}`,
  )
  return { items: all(entries.map(({ item }) => item)), declared }
}

function readStyle(f: Findings, value: unknown, path: string): Read<PrintStyle, true> {
  const o = shape(f, value, path, ['id'], ['font', 'size', 'bold', 'italic', 'color', 'align'])
  const id = identifier(f, o?.id, at(path, 'id'))
  const entry = { id, path: at(path, 'id'), value: true as const }
  if (o === undefined || id === undefined) return { entry, item: undefined }
  return {
    entry,
    item: {
      id,
      ...optional('font', oneOf(f, o.font, at(path, 'font'), FONT_FAMILIES)),
      ...optional('size', fontSize(f, o.size, at(path, 'size'))),
      ...optional('bold', flag(f, o.bold, at(path, 'bold'))),
      ...optional('italic', flag(f, o.italic, at(path, 'italic'))),
      ...optional('color', matches(f, o.color, at(path, 'color'), COLOR, 'invalid-color', 'a colour written #rrggbb in lower case')),
      ...optional('align', oneOf(f, o.align, at(path, 'align'), ALIGNMENTS)),
    },
  }
}

export function readStyles(c: Ctx, value: unknown, path: string): readonly PrintStyle[] | undefined {
  const { items, declared } = readDeclarations(c, value, path, MAX_STYLES, 'style', (item, where) => readStyle(c.f, item, where))
  c.declared.styles = declared
  return items
}

/** A field contract, and whether it says where a form holds it, as written: the dataset holds that to whether it reads a form. */
function readFieldContract(f: Findings, value: unknown, path: string): Read<FieldContract, FieldType | undefined> & { readonly formed: boolean } {
  const o = shape(f, value, path, ['id', 'type', 'label', 'nullable'], ['scale', 'form'])
  const id = fieldKey(f, o?.id, at(path, 'id'))
  const type = oneOf(f, o?.type, at(path, 'type'), FIELD_TYPES)
  const label = text(f, o?.label, at(path, 'label'), MAX_LABEL_LENGTH)
  const nullable = flag(f, o?.nullable, at(path, 'nullable'))
  const scale = integer(f, o?.scale, at(path, 'scale'), 0, MAX_SCALE)
  if (scale !== undefined && type !== undefined && type !== 'decimal') {
    f.report(at(path, 'scale'), 'scale-on-non-decimal', `a scale says how many decimal places a decimal field has, and this field is a ${type}`)
  }
  const formed = o?.form !== undefined
  const form = formed ? readFieldForm(f, o?.form, at(path, 'form'), type) : undefined
  const entry = { id, path: at(path, 'id'), value: type }
  if (id === undefined || type === undefined || label === undefined || nullable === undefined || (formed && form === undefined)) return { entry, item: undefined, formed }
  return { entry, item: { id, type, label, nullable, ...optional('scale', scale), ...optional('form', form) }, formed }
}

/** A dataset contract, recording its fields under its role, and what it says of a form. */
function readDataset(c: Ctx, value: unknown, path: string, role: DatasetRole, declared: Map<string, Declarations<FieldType | undefined>>): { readonly contract: DatasetContract | undefined; readonly form: DatasetForm } {
  const o = shape(c.f, value, path, ['id', 'fields'], ['form'])
  const id = identifier(c.f, o?.id, at(path, 'id'))
  const formed: boolean[] = []
  const fields = readDeclarations(c, o?.fields, at(path, 'fields'), MAX_DATASET_FIELDS, 'field of this dataset', (item, where) => {
    const read = readFieldContract(c.f, item, where)
    formed.push(read.formed)
    return read
  })
  declared.set(role, fields.declared)
  const read = o?.form !== undefined
  const { binding, kind } = read ? readDatasetForm(c.f, o?.form, at(path, 'form')) : { binding: undefined, kind: undefined }
  checkFieldsBound(c.f, path, read, formed)
  const contract = id === undefined || fields.items === undefined || (read && binding === undefined) ? undefined : { id, fields: fields.items, ...optional('form', binding) }
  return { contract, form: { read, kind } }
}

export function readDatasets(c: Ctx, value: unknown, path: string): Datasets | undefined {
  const o = shape(c.f, value, path, [], DATASET_ROLES)
  if (o === undefined) return undefined
  const declared = new Map<string, Declarations<FieldType | undefined>>()
  c.declared.datasets = declared
  const header = o.header === undefined ? undefined : readDataset(c, o.header, at(path, 'header'), 'header', declared)
  const detail = o.detail === undefined ? undefined : readDataset(c, o.detail, at(path, 'detail'), 'detail', declared)
  if (header?.contract !== undefined && detail?.contract !== undefined && header.contract.id === detail.contract.id) {
    c.f.report(at(at(path, 'detail'), 'id'), 'duplicate-id', `the header dataset is already "${detail.contract.id}"; each dataset is bound to a provider by its own id`)
  }
  checkDatasetForms(c.f, path, { ...optional('header', header?.form), ...optional('detail', detail?.form) })
  return { ...optional('header', header?.contract), ...optional('detail', detail?.contract) }
}

/** What a default looks like for each parameter type, and how to tell. Exact values are strings. */
const DEFAULTS: { readonly [T in ParameterType]: { readonly accepts: (value: unknown) => boolean; readonly shape: string } } = {
  string: { accepts: (value) => typeof value === 'string', shape: 'a string' },
  integer: { accepts: (value) => typeof value === 'string' && INTEGER.test(value), shape: 'an integer written as a string, such as "12"' },
  decimal: { accepts: (value) => typeof value === 'string' && DECIMAL.test(value), shape: 'a decimal written as a string, such as "12.50"' },
  boolean: { accepts: (value) => typeof value === 'boolean', shape: 'true or false' },
  date: { accepts: (value) => typeof value === 'string' && isCalendarDate(value), shape: 'a calendar date written YYYY-MM-DD' },
}

function readDefault(f: Findings, value: unknown, path: string, type: ParameterType | undefined): string | boolean | undefined {
  if (value === undefined || type === undefined) return undefined
  if (typeof value === 'string' && text(f, value, path, MAX_LABEL_LENGTH) === undefined) return undefined
  if (DEFAULTS[type].accepts(value)) return value as string | boolean
  f.report(path, 'invalid-default', `a default for a ${type} parameter is ${DEFAULTS[type].shape}; this is ${describe(value)}`)
  return undefined
}

function readParameter(f: Findings, value: unknown, path: string): Read<ParameterDef, ParameterType | undefined> {
  const o = shape(f, value, path, ['id', 'type', 'label', 'required'], ['default'])
  const id = fieldKey(f, o?.id, at(path, 'id'))
  const type = oneOf(f, o?.type, at(path, 'type'), PARAMETER_TYPES)
  const label = text(f, o?.label, at(path, 'label'), MAX_LABEL_LENGTH)
  const required = flag(f, o?.required, at(path, 'required'))
  const fallback = readDefault(f, o?.default, at(path, 'default'), type)
  const entry = { id, path: at(path, 'id'), value: type }
  if (id === undefined || type === undefined || label === undefined || required === undefined) return { entry, item: undefined }
  return { entry, item: { id, type, label, required, ...optional('default', fallback) } }
}

export function readParameters(c: Ctx, value: unknown, path: string): readonly ParameterDef[] | undefined {
  const { items, declared } = readDeclarations(c, value, path, MAX_PARAMETERS, 'parameter', (item, where) => readParameter(c.f, item, where))
  c.declared.parameters = declared
  return items
}

function readAsset(f: Findings, value: unknown, path: string): Read<AssetRef, AnyAssetMediaType | undefined> {
  const o = shape(f, value, path, ['id', 'mediaType', 'digest'])
  const id = identifier(f, o?.id, at(path, 'id'))
  const mediaType = oneOf(f, o?.mediaType, at(path, 'mediaType'), ASSET_AND_FONT_MEDIA_TYPES)
  const digest = matches(f, o?.digest, at(path, 'digest'), DIGEST, 'invalid-digest', '"sha256:" and 64 lower-case hex digits')
  const entry = { id, path: at(path, 'id'), value: mediaType }
  return { entry, item: id === undefined || mediaType === undefined || digest === undefined ? undefined : { id, mediaType, digest } }
}

export function readAssets(c: Ctx, value: unknown, path: string): readonly AssetRef[] | undefined {
  const { items, declared } = readDeclarations(c, value, path, MAX_ASSETS, 'asset', (item, where) => readAsset(c.f, item, where))
  c.declared.assets = declared
  return items
}

/** Each kind of provenance: what it names, and how to read it. */
const PROVENANCE: { readonly [K in ProvenanceKind]: { readonly required: readonly string[]; readonly read: (f: Findings, o: Record<string, unknown>, path: string) => Provenance | undefined } } = {
  blank: { required: [], read: () => ({ kind: 'blank' }) },
  form: {
    required: ['form', 'formHash'],
    read: (f, o, path) => {
      const form = matches(f, o.form, at(path, 'form'), FORM_ID, 'invalid-id', "a form's id as formancy writes one: letters, digits, '.', '_' and '-', starting with a letter or digit")
      const formHash = matches(f, o.formHash, at(path, 'formHash'), SCHEMA_HASH, 'invalid-digest', "the form version's schemaHash: 64 lower-case hex digits")
      return form === undefined || formHash === undefined ? undefined : { kind: 'form', form, formHash }
    },
  },
  dataset: {
    required: ['dataset'],
    read: (f, o, path) => {
      const dataset = identifier(f, o.dataset, at(path, 'dataset'))
      return dataset === undefined ? undefined : { kind: 'dataset', dataset }
    },
  },
}

export function readProvenance(f: Findings, value: unknown, path: string): Provenance | undefined {
  const o = readObject(f, value, path)
  const kind = o && kindOf(f, o, path, PROVENANCE_KINDS)
  if (o === undefined || kind === undefined) return undefined
  strictKeys(f, o, path, ['kind', ...PROVENANCE[kind].required])
  return PROVENANCE[kind].read(f, o, path)
}
