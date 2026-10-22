# @formancy/report-builder-react

Formancy Report Studio's report builder for React. It renders the three
panes of the workbench over one
[`report-builder-core`](../report-builder-core/README.md) editor: the
palette and the outline, the design view, and the properties with the
problems. A toolbar sits above them and a status line below.

It renders the editor's state and dispatches what the person did. It
decides nothing the editor decides: the keys are `actionForKey`'s, the
places a component may go are the editor's drop targets, what is
available is the editor's `can`, and every word comes from the editor's
catalogue. What is React's is the subscription (`useSyncExternalStore`),
the DOM, and focus, because only the builder knows which element the
person was on. The Angular builder renders the same state, and neither
depends on the other
([0012](../../docs/decisions/0012-the-builders-are-native-and-share-one-session.md)).

## Mounting it

```tsx
import '@formancy/themes/workbench.css'
import '@formancy/report-builder-core/report-builder.css'
import { createReportEditor } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import { ReportBuilder } from '@formancy/report-builder-react'

const opening = openReportSession(report)
if (!opening.ok) throw new Error('not a report')
const editor = createReportEditor(opening.session, { locale: 'de-CH' })

// The builder fills its container; the host gives the container a height.
root.render(
  <div style={{ height: '100vh' }}>
    <ReportBuilder editor={editor} />
  </div>,
)

// Once no builder shows it:
editor.dispose()
```

The package imports no CSS and sets no style of its own but the state's
geometry. The host imports `workbench.css` from `@formancy/themes`, then
`report-builder.css` from `report-builder-core`, and recolours the builder
by setting the workbench's `--wb-*` variables.

**`ReportBuilder` takes the `editor`.** The builder subscribes while
it is mounted and never disposes the editor. Whoever created the editor
disposes it, once no builder shows it. Given another editor, the builder
lets go of the old one and subscribes to the new one.

**`hostView` is what it draws in the design view's place** while the
editor's `view` is the host's: a view of the host's own, which the editor
was made knowing by name
([0029](../../docs/decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).

```tsx
const editor = createReportEditor(opening.session, { hostView: { name: 'Preview', shown: true } })

root.render(<ReportBuilder editor={editor} hostView={<Preview />} />)
```

The builder lends it the middle pane's box and a region named by the
editor's `hostView`. No rule of `report-builder.css` reaches it, and of
the workbench's only `.wb *`, which turns transitions off when motion is
reduced; none of the builder's keys do either, nor from a portal the host
opens from it, whose events React bubbles through the view wherever its
DOM is. It is mounted only while it is drawn: the toolbar's Design view
unmounts it, and the editor's `showHostView` mounts it again.

**Images a person adds need nothing of the builder.** A host that keeps
them gives the editor its store (`createReportEditor`'s `images`,
report-builder-core's *Images a person adds*), and the builder draws Add
image… last in the palette, with a hidden file input beside it, and the
report's images, each with its Remove, under the report's own properties
([0033](../../docs/decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)). Add image… sends `chooseImage` and opens the platform's chooser
in the same click; the file chosen is taken, the input cleared so the same
file is a change again, and handed to `editor.addImage`, which says what
became of it. The keyboard stays on the button; a Remove that removed its
image puts it on the first field.

**A report's QR-bill is selected and edited like a component**
([0039](../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)): its row stands in the outline after the regions, its band
on the canvas selects it with a click, and the properties draw its fields
and its parties as groups, each a `group` named in the editor's words with
its one button, Remove debtor or Add debtor, which keeps the keyboard as
its words change. Add QR-bill, in the report's own properties, takes its
button away with them, and the keyboard goes to the bill's IBAN, as it
does when a Remove takes its row.

**`useEditorState(editor)`** is the subscription on its own, for a host
that shows something of the editor's state outside the builder.

The panes are not exported as components of their own. Focus moves
between them: a place chosen in the dialog focuses its outline row, and a
problem followed focuses the row it is about. That coordination belongs
to the builder as a whole.

### One session, many builders

The document and its undo history live in the session, and the editor
holds only one person's view of it (plan 11.4). So the builder can come
and go without losing anything, and two builders can share one session:

- **Unmounted and mounted again** over the same editor, it shows the same
  document and can undo the edit made before it went away. The editor's
  listener count is back where it was after each unmount.
- **Given another editor** over the same session, in another language, it
  undoes the step the first one made, and the first editor has no listener
  left. This is plan 21's switch between two React editors. The Angular
  half of the switch is the Angular builder's to show.
- **Two builders on one page** stay in step: an edit in one shows in the
  other, and each keeps its own selection. No element id is minted twice
  (`useId`). A duplicated id would label the second builder's fields with
  the first builder's labels, and a test fails on exactly that.

## What it renders

Exactly the structure `report-builder-core`'s README sets out under *What a
builder renders*, which the Angular builder renders too: a region named
"Report editor" with a bar above the panes (the title and the toolbar,
with its four pane buttons), the outline pane with the place dialog
floating over it, the design view -- or the host's view in its place --
the properties and the problems sharing the third column, and a bar below
with the live region.

## The keyboard

Every pointer action has a keyboard path (formancy.ai 0046), and the
keyboard path came first.

| Where | Keys | Does |
| --- | --- | --- |
| The outline | ↑ ↓, Home, End | Selects the previous, next, first or last row. Focus follows. |
| The outline | ← → | Selects what holds the row, or the first thing it holds. |
| The outline | Alt+↑, Alt+↓ | Moves the selection up or down its list. |
| The outline | Alt+→, Alt+← | Moves it into the container before it, or out of its own. |
| The outline | Delete, Backspace | Deletes it. Focus goes to the next row, else the one before, else the tree. |
| The outline | Ctrl+D (⌘D) | Duplicates it, and selects the copy. |
| Anywhere but a text field | Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z | Undoes, redoes. In the outline, focus goes to the selected row, else to the tree itself, never to a row nothing selected. |
| Anywhere but a text field | Ctrl and +, −, 0 | Zooms in, out, to actual size. |
| The toolbar | ← →, Home, End | Moves between tools. The toolbar is one tab stop. → is "next" in a left-to-right page and "previous" under `dir="rtl"`; with Ctrl, Alt or ⌘ held the arrow is the browser's. |
| A palette entry, Move to… | Enter, Space | Opens the place dialog. Focus goes to its first place. |
| Add image… | Enter, Space | Opens the platform's file chooser. Focus stays on the button while the image is added and after. |
| The place dialog | Enter on a place | Inserts or moves there. Focus goes to the row. |
| The place dialog | Escape, Cancel | Closes it. Focus goes back to what opened it; for a dialog another builder over the same editor opened, to the palette entry of what is placed, else the selected row, else the tree. |
| A single-line field | Enter | Commits the value, and stays in the field. |
| A text field | Escape | Gives back what the report holds. |
| The host's view | Any | The host's, and a portal's the host opens from it. The builder passes none of them on, so Ctrl+Z there undoes nothing of the report. |

The keys in the outline and the editor's shortcuts are `actionForKey`'s,
decided in `report-builder-core` for both builders. A text field, a
number field and a select keep their own keys: Ctrl+Z there undoes
typing, not the report. A checkbox has no typing to undo, so Ctrl+Z on it
undoes the report.

**Focus follows the selection.** Moving focus to a row selects it. Every
action that selects moves focus to that row: a place chosen, a box
clicked, a problem followed. So a screen reader says what was selected as
the focused row's name and state. The editor does not say it again in the
live region.

A tool with nothing to act on is `aria-disabled`, not `disabled`, and
`report-builder.css` draws it as the workbench draws a disabled button. It
stays focusable, so pressing Redo for the last time does not throw focus
out of the toolbar. Pressing such a tool says why nothing happened
("Nothing to undo.").

## The pointer

A palette entry, a box or an outline row can be dragged. It can be dropped
on the canvas, at the nearest place in the list under the pointer
(`targetNear`, read inside the sheet's border), or over an outline row,
before or after it (`targetBeside`). The drag is the editor's state
machine: `startDrag`, `updateDrag`, `drop`, `cancelDrag`. A pointer is
never offered a place the session would refuse, and it is offered exactly
the places the dialog lists.

A press becomes a drag only after it moves 4 CSS pixels, Windows' default
drag distance (a convention, not a measurement). A click stays a click: it
opens the dialog, or selects a box. Escape, the browser cancelling the
pointer, and the builder unmounting all end a drag with nothing placed.
Letting go over nothing says "Nothing was moved." Only the primary button
of a mouse or pen drags. A touch never starts a drag, so a finger scrolls
the page as it expects to, and a tap is a click. The Angular builder drags
with HTML's drag and drop instead, over the same places.

## The words, and what is said aloud

Every word the builder shows comes from `report-builder-core`'s catalogue,
in English, Swiss German and Swiss French, and none is written here.

The status line is a polite live region. Each announcement is a new child
element, so the same words said twice ("Nothing to undo.") are two
announcements. The zoom `<output>` has `aria-live="off"`: the status line
already says "Zoom 125%.", and an `<output>` would say it a second time.
The problems' count is a `status` of its own, so a problem an edit causes
is announced ("Problems 1") without moving the person.

## What the tests show

`pnpm --filter @formancy/report-builder-react test` runs the suite in
jsdom with Testing Library and user-event:

- **Every one of `BUILDER_SCENARIOS`, in all three languages.** Each
  scenario runs step by step, with axe over its end state. A last test
  fails when a scenario was skipped or lost.
- **axe** holds the builder to WCAG 2.2 AA by its tags (`wcag2a` through
  `wcag22aa`). `best-practice` is left out, as formancy.ai's builders leave
  it out. Two rules are off because jsdom cannot decide them:
  `color-contrast` (jsdom computes no colour) and `target-size` (jsdom
  lays nothing out). The reason for each is written beside it in
  `test-support.tsx`.
- **Every part, named.** One report holds every kind of component. Each
  row is selected in turn, so every kind of property control is drawn and
  audited. Every element with a role a person operates or reads must have
  a name. A test fails if no row of that report shows some kind of
  property. Each group, the form, the list, the statuses and the dialog
  are named in the editor's words, never after text on the page, which
  Chromium would read in the stylesheet's capitals; jsdom applies no
  stylesheet, so that test reads from the DOM how each name is given.
- **The keyboard, focus and the pointer** beyond the scenarios: the
  toolbar's tab stop and its arrows, focus after each action, the dialog's
  way out, the panes, a text field's own keys, every pointer drag above,
  the pointer read inside the sheet's border, and the keyboard kept on a
  problem when another is listed before it.
- **Images**: `image-chooser.test.tsx` gives the file input `files` and a
  `value` that behave as a browser's, where clearing the value empties the
  files, and holds the file taken before the input is cleared, the input
  cleared, a chooser closed without a file doing nothing, the keyboard on
  Add image… while an image is added and after, Enter and Space opening
  the chooser, no chooser where the editor takes no file, nothing drawn
  without a store, and the host's types offered. `properties.test.tsx`
  holds the image rows. These, and the scenarios' `upload`, find the file
  input beside the button in the DOM: it has no role.
- **One session, many builders**, as above.
- **The host's view**: a bare region in the design view's place, with the
  middle pane's `data-pane`, its own part, no workbench class and only the
  host's node in it, which is mounted while the region is drawn and
  unmounted with it; and a key pressed in a portal the host opens from it,
  Ctrl+Z on a menu in the body, undoes nothing. That test reads the DOM,
  because which rules reach the host's view is a stylesheet's reach, which
  the accessibility tree cannot show.

Each guard was watched failing with the code it guards removed. Among
them: the subscription left behind on unmount, ids shared between two
builders, the drag distance, the swallowed click, focus returned after
Escape, `aria-disabled` turned into `disabled`, an announcement without a
new child, the sheet's border, and a modified arrow taken by the toolbar.

## What it does not do

- **No browser runs in this package's suite.** jsdom has no layout, so
  the suite does not test the three-pane and narrow layouts, scrolling,
  contrast or target sizes, and its pointer tests place the pointer by the
  editor's own pixel geometry. The Studio's browser gate
  (`apps/studio/scripts/browser-test.mjs`) measures them in Chromium for
  this builder in the Studio's page, a real pointer's drag from the
  palette included, and compares its accessible tree with the Angular
  builder's; the root README's pictures of it are taken by a
  script and held to the text they show
  ([0013](../../docs/decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md));
  a host's own page is its own to measure.
- **The place dialog's "nowhere" sentence** shows when a component has
  nowhere else to go. No report tried here has such a component. The test
  draws the dialog over a state that says so.
- Everything `report-builder-core` lists under *What it does not do*
  holds here too: the canvas is not the PDF, some properties have no
  editor yet, and two problems about the report as a whole share a name.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
