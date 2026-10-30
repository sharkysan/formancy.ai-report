/*
 * Reads the markup a server renderer writes, as a tree, so react.tsx and
 * angular.ts can ask of it what assistive technology would: which roles
 * there are, what each is named, and what stands inside what.
 *
 * Not an HTML parser. It reads two writers' output -- React's
 * `renderToString` and the DOM Angular's platform-server serialises --
 * which share a shape: attributes in double quotes, a void element closed
 * with `/>` (React) or `>` (Angular), and text escaped with a handful of
 * entities. It throws on anything else -- an entity neither writes, a tag
 * left open or closed out of order, a `/>` on an element that has content
 * -- so a change in either writer fails here loudly rather than being read
 * wrong.
 */

export interface MarkupElement {
  readonly tag: string
  readonly attributes: ReadonlyMap<string, string>
  readonly children: readonly (MarkupElement | string)[]
}

interface Building {
  readonly tag: string
  readonly attributes: Map<string, string>
  readonly children: (Building | string)[]
}

/** The elements that never have content, which React closes with `/>` and Angular with `>`. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/** The escapes either writer uses, in text and in attribute values: React's five, and Angular's `&nbsp;`. */
const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&nbsp;': ' ' }
const unescape = (text: string, at: number): string =>
  text.replace(/&[^;&\s]*;?/g, (entity) => {
    const character = ENTITIES[entity]
    // Both writers escape every `&`, so one that starts no known entity is markup this does not know.
    if (character === undefined) throw new Error(`unknown entity ${entity} at ${String(at)}`)
    return character
  })

/** One token at a time: a comment (React's text separators, Angular's anchors), a closing tag, an opening tag, or text. */
const TOKEN = /<!--[\s\S]*?-->|<\/([a-z][a-z0-9-]*)>|<([a-z][a-z0-9-]*)((?:\s[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/y
const ATTRIBUTE = /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g

/** The markup as a fragment: a root whose children are what `html` holds at its top level. */
export function readMarkup(html: string): MarkupElement {
  const root: Building = { tag: '#fragment', attributes: new Map(), children: [] }
  const open: Building[] = [root]
  const tokens = new RegExp(TOKEN.source, 'y')
  while (tokens.lastIndex < html.length) {
    const at = tokens.lastIndex
    const token = tokens.exec(html)
    if (token === null) throw new Error(`unreadable markup at ${String(at)}: ${html.slice(at, at + 60)}`)
    const [, closing, tag, attributes = '', selfClosing, text] = token
    // The fragment is never closed, so something is always open.
    const parent = open.at(-1) ?? root
    if (text !== undefined) {
      parent.children.push(unescape(text, at))
    } else if (closing !== undefined) {
      if (closing !== parent.tag) throw new Error(`</${closing}> closes <${parent.tag}> at ${String(at)}`)
      open.pop()
    } else if (tag !== undefined) {
      // A browser reads `<div/>` as an open <div>: neither writer writes one, and reading it as empty would be reading it wrong.
      if (selfClosing === '/' && !VOID.has(tag)) throw new Error(`<${tag}/> at ${String(at)} closes an element that has content`)
      const element: Building = {
        tag,
        attributes: new Map([...attributes.matchAll(ATTRIBUTE)].map(([, name = '', value = '']) => [name, unescape(value, at)])),
        children: [],
      }
      parent.children.push(element)
      if (!VOID.has(tag)) open.push(element)
    }
  }
  if (open.length !== 1) throw new Error(`<${String(open.at(-1)?.tag)}> is never closed`)
  return root
}

/** Every element inside `root`, in document order. */
export function elementsIn(root: MarkupElement): MarkupElement[] {
  return root.children.flatMap((child) => (typeof child === 'string' ? [] : [child, ...elementsIn(child)]))
}

/**
 * The text a person hears for `element`'s content: what it holds, without
 * what is `hidden` or `aria-hidden` -- a palette entry's unavailable
 * sentence, an outline row's problem count.
 */
export function spokenText(element: MarkupElement): string {
  return element.children
    .map((child) => {
      if (typeof child === 'string') return child
      return child.attributes.has('hidden') || child.attributes.get('aria-hidden') === 'true' ? '' : spokenText(child)
    })
    .join('')
}
