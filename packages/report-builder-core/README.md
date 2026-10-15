# @formancy/report-builder-core

Formancy Report Studio's editor model, with no framework in it. It holds the
selection, the palette, the outline, the property fields, the page geometry,
the keyboard actions and the drop targets, all over one `report-core`
session. The React and Angular builders render its state and send its
actions. Neither one decides anything this package decides.
No framework, no DOM, no Node: its TypeScript library is ES2023 only.

Commands, the session and undo are
[0008](../../docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)'s,
and the diagnostics are
[0009](../../docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)'s.
This package edits through them and never around them. Why there is one
model under two native builders, and what holds them to each other, is
[0012](../../docs/decisions/0012-the-builders-are-native-and-share-one-session.md).

## An editor

```ts
import { openReportSession } from '@formancy/report-core'
import { emptyReport } from '@formancy/report-spec'
import { actionForKey, createReportEditor } from '@formancy/report-builder-core'

const opening = openReportSession(emptyReport('site-visit', 'Site visit', 'de-CH'))
if (!opening.ok) throw new Error('not a report')

const editor = createReportEditor(opening.session, { locale: 'de-CH' })

// The state is deeply frozen and stays the same object until something
// changes. React reads it with useSyncExternalStore; Angular sets a signal
// from it.
const unsubscribe = editor.subscribe(() => render(editor.state()))

// A builder sends what the person did. It never edits the report itself.
editor.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 0 } })
editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: 'Befund' })

// Keys are decided here once, so both builders bind the same ones.
const action = actionForKey({ key: 'ArrowDown', altKey: true }, 'outline')
if (action !== undefined) editor.dispatch(action) // moveDown

unsubscribe()
editor.dispose() // unsubscribes from the session
```

**Several editors can share one session**, at the same time or one after
another. The document and its undo history live only in the session.
What belongs to one editor never reaches the report: its selection, zoom,
open pane and drag. An edit made in the Angular builder is undone in the
React one, and each shows the step's label in its own language. Plan 21's
switch test (edit in one, switch, undo, switch back) runs here against the
model, with no subscription left behind.

A listener of one editor that throws does not leave another editor half
done. The session commits an edit and then tells every listener (0008), so
an error from a listener of another editor, or of a host, arrives after the
edit has been made: the editor that made it still selects what follows,
says what it did and tells its own listeners, and only then throws the
error from `dispatch`. A dispatch made from inside a listener while another
is running counts as part of it, so listeners still hear once.

## The state

`editor.state()` returns one `EditorState`:

- **`document`**: the title, the page in points and in CSS pixels at the
  zoom, and each region with its label and how many components it holds.
- **`outline`**: the regions, then the components in each as a tree, with a
  table's columns under it. Each row has its kind, its id, its depth,
  whether it is selected, how many diagnostics are about it and the worst
  of their severities, and whether it is wider than the space it stands
  in. Its label is what a person calls it: a text by what it prints, a
  bound run by what it binds. Labels are unique in the report, so each can
  be an accessible name; where two would read the same, each gets its id.
- **`selection`**: a component, or one column of a table.
- **`palette`**: every kind the format has, with the default component
  inserting it would put in. Its id comes from `nextComponentId` and its
  size fits the printable area. What it says -- a new text's "New text" --
  is in the report's language, because it prints: two editors in two
  languages inserting into one report put in the same words
  (`contentLocale`). Where the report lacks what a kind needs (an image
  with nothing to draw, a table with no detail dataset), the entry says
  what to declare first.
- **`properties`**: the fields of the selection, or of the report when
  nothing is selected. They are derived from report-spec's type for each
  kind. Each field has a key, a label, a kind (`text`, `multiline`, `number`,
  `length`, `select`, `boolean`, `color`, `expression`, `binding`, `style`), a
  value, and options where it has them. It also has an error: why the last
  value was refused, or the diagnostic about what it holds.
  `PROPERTY_ROLES` gives the role each kind's native control has. A length
  is stored in points and edited in millimetres, converted with
  report-spec's `mmToPt`; a length given back as it was shown is left
  alone, and a length too large for the page is refused in millimetres,
  with the room the margins leave.
- **`canvas`**: the design view. It is one sheet as wide as the page, with
  the regions as bands and each component's flow box in its band, in points
  and in pixels, with the same severity and overflow its outline row has.
  It also carries rulers in millimetres. It is labelled as not the PDF,
  because it is not; see *What it does not do*.
- **`diagnostics`**: report-core's `diagnose()`, each entry linked to the
  component or column it is about.
- **`history`**: whether undo and redo can run, and what they would take
  back.
- **`drag`** and **`dropTargets`**: while something is being placed, the
  places it may go. These are report-core's `validLocations`, each named
  ("Body, after Introduction") and drawn on the canvas. A move leaves out
  where the component already stands. Where two places would be drawn on
  one line -- the end of a container's list and the place just after the
  container -- the deeper one is drawn a line further into its container,
  so the pointer can reach both.
- **`can`**: which actions have somewhere to go: the keyboard's moves on
  the selection, decided by the same code that performs them, and the
  zoom's, by its range. A builder marks the others `aria-disabled` and
  still sends them, so the editor says why nothing happened.
- **`status`**: the latest announcement for the live region, numbered so
  that saying the same words twice is still two announcements.

## Actions

`dispatch(action)` never throws on the action it is given, even one a
JavaScript caller made up. It returns `{ ok: true }`, or a refusal with a
stable code (`EDITOR_REFUSAL_CODES`) and a message in the editor's language.
A refusal from report-core carries report-core's refusal, with the
validator's errors in it. The one exception is a listener that throws,
this editor's or another's on the same session: its error surfaces from
`dispatch` once the action is done and every listener has run, as the
session's do.

| Action | Does |
| --- | --- |
| `select`, `selectNext`, `selectPrevious`, `selectFirst`, `selectLast` | Selects a component or a table column; the four steps walk the outline's order. |
| `selectParent`, `selectChild` | Steps out to the container a row stands in (a column's table), or into the first thing it holds; says why where there is none. |
| `moveUp`, `moveDown` | Reorders the selection within its list, a table's columns included. Refused at either end, never clamped. |
| `indent`, `outdent` | Moves into the container just before it, at the end of what that holds, or out to just after its own container. |
| `delete` | Deletes, and selects the next item in the list, else the one before, else the container. |
| `duplicate` | Copies to just after it with fresh ids, and selects the copy. |
| `insert(kind, target)`, `move(id, target)` | The keyboard path for a drop: a kind, or an id, and a location. |
| `setProperty(key, value)` | Writes one field through a typed report-core command. A refused value keeps what was typed, and shows the reason on that field. |
| `undo`, `redo` | Through the session. |
| `setZoom`, `zoomIn`, `zoomOut` | Clamped to `MIN_ZOOM` to `MAX_ZOOM`; the two steps go through `ZOOM_STEPS`. |
| `startDrag`, `updateDrag`, `drop`, `cancelDrag` | Pointer drag as a state machine. `targetNear` and `targetBeside` turn a pointer position or an outline row into a target. |
| `openPanel` | The pane a narrow layout shows. |

Every pointer gesture has a keyboard path (formancy.ai 0046). `actionForKey`
gives the keys:

- **In the outline:** ↑ and ↓ walk it, ← goes to what holds the row and →
  to the first thing it holds, Home and End jump. Alt with an arrow moves
  up and down, indents and outdents. Delete or Backspace deletes, and
  Ctrl+D (Cmd+D on a Mac) duplicates.
- **Anywhere in the editor:** Ctrl+Z undoes. Ctrl+Y or Ctrl+Shift+Z redoes.
  Ctrl with +, - and 0 zooms. Escape cancels a drag.
- **Text fields** keep their own keys, and the builder does not pass them
  here.

To choose a place by keyboard, the builder starts a drag with
`via: 'keyboard'` and lists `dropTargets` as buttons. Choosing one is an
`insert` or a `move`.

## What a builder renders

Both builders render the same accessible structure. The scenarios find
everything in it by role and accessible name, and nothing else. Where this
list once left a choice open, the two builders made different ones, and
the review that compared them found each difference only by reading both;
so the choices are made here.

- **The editor's root:** a `region` named `editor.label`, with
  `data-report-part="editor"`, the workbench's `wb` class, and `data-panel`
  set to the state's `panel`. Its children, in order:
  - a bar holding the report's title and the toolbar;
  - the outline pane (`data-pane="outline"`): the palette, then the tree,
    with the place chooser floating over them;
  - the design view's pane (`data-pane="canvas"`, also `wb-canvas`);
  - the third column, whose `data-pane` is `diagnostics` while that is the
    panel and `properties` otherwise; its properties half and its problems
    half each carry their own `data-pane`;
  - a bar holding the live region.

  Each pane has the workbench's `wb-pane` class, and so do the bars, which
  stand in no pane: `report-builder.css` spans every child that is no pane
  across the columns, so on a narrow screen neither bar is hidden.
- **A toolbar:** `role="toolbar"` named `toolbar.label`, one tab stop, the
  arrow keys, Home and End moving between its buttons the way the page
  reads (→ is the previous tool under `dir="rtl"`); an arrow held with
  Ctrl, Alt or Cmd is left to the browser. It holds buttons named Undo,
  Redo, Move up, Move down, Indent, Outdent, Move to…, Duplicate, Delete,
  Zoom out, Zoom in and Actual size, with an `<output>` named Zoom showing
  `zoomLabel` (`aria-live="off"`, because the live region says it), and
  four buttons named after the panes -- Outline, Design view, Properties,
  Problems -- each dispatching `openPanel` and taking focus into its pane.
  A tool with nowhere to go (`can`, `history`) is `aria-disabled`, stays
  focusable, and is still sent, so the live region says why; Move to… with
  nothing but a table's column selected opens nothing.
- **The palette:** a group named `pane.palette`, with one button per entry
  named by its label. An entry with no component is `aria-disabled` and
  described by its `unavailable` sentence. Activating one starts a keyboard
  drag of its kind.
- **The place chooser:** while `drag.via` is `'keyboard'`, a dialog named
  `drag.title`, floating over the outline pane, which `openPanel` shows. It
  holds a button per drop target named by its label, and a Cancel button.
  Focus goes to the first place, or to Cancel when there is none, and the
  dialog is then described by `drag.nowhere`. The place a button stands for
  is marked on the canvas while the button has focus. Choosing a place
  moves focus to the selected outline row; Cancel and Escape move it back
  to what opened the chooser.
- **The outline:** `role="tree"` named `pane.outline`, with a group per
  region named by its label. Each row is a `treeitem` named by its label,
  with `aria-level` set to depth + 1, `aria-posinset`, `aria-setsize` and
  `aria-selected`, described by its problem count and, when it overflows,
  by `canvas.overflow`. One row is a tab stop -- the selected one, else the
  first -- and the tree itself is when it has no rows. Focus and selection
  are one: focus moving to a row selects it, and every action that selects
  moves focus to its row.
- **The properties:** a `form` named by `properties.heading`, one native
  control per field, labelled by the field's label, with the role
  `PROPERTY_ROLES` gives and `required` where the field is. A text field
  commits when it changes (on blur, or Enter in a single-line field), and
  Escape gives back what the report holds. A refused value sets
  `aria-invalid="true"` and an `aria-describedby` pointing to the visible
  error. While something is selected, a button named `properties.report`
  above the form selects nothing and takes focus to the first field: the
  way back to the report's own properties.
- **The problems:** a `status` named `pane.problems` whose text is the
  name and, when there are any, their count ("Problems 2"), so a change in
  the count is announced; then a list named `pane.problems`, with one
  button per diagnostic named by its label and described by its message.
  Activating one selects what it is about and focuses that outline row.
- **The canvas:** a region named `canvas.label`, one tab stop so a
  keyboard can scroll it, with the note that says it is not the PDF. Each
  box is an `img` named by its label; a click selects it and moves focus to
  its outline row. While something is placed, each drop target is drawn as
  an `img` named by its label. A pointer reads its position from the
  sheet's padding edge, inside its border, as the targets are placed.
- **A live region** (`role="status"`, unnamed) showing `status.text`, each
  announcement a new element.

Every piece carries a `data-report-part` from `REPORT_PARTS`, and its
states use `REPORT_ATTRIBUTES`; a badge's colour is the row's or box's
`severity`. Geometry (left, top, width, height in pixels) is set inline
from the state.

## The scenarios

`BUILDER_SCENARIOS` lists what each native builder must do, as data. Each
scenario has a report to open, a language, and steps:
`{ do: 'press', key: 'Delete' }`, `{ do: 'click', role: 'treeitem', name: 'Introduction' }`,
`{ expect: 'focused', role, name }`, `{ expect: 'document', check }`. The
scenarios insert a text by keyboard, select in the outline and walk it
with every arrow, select a row by focusing it, edit the title, go back to
the report's properties from a selection, refuse an invalid property with
its error visible, move by keyboard, delete with focus moving on,
duplicate, undo and redo, follow a diagnostic to its component, count the
problems as they change, press a tool with nothing to do, zoom and choose
a style.

Each framework's test runs every scenario with Testing Library, and fails
when one is skipped. The scenarios use every kind of step, so each runner
has to implement every kind. `builderScenarios(locale)` gives the same list
in German and French. The names come from the catalogue and from the
scenario report's own text.

Here the scenarios run against the model alone, through a headless reading
of the contract above. That shows every name they look for is one the
state gives. Focus, roles and what is visible are for the framework runs to
show.

## The stylesheet

`@formancy/report-builder-core/report-builder.css` dresses what is specific
to reports: the bars above and below the panes, the sheet, its region
bands, rulers, the selection, drop indicators, outline rows, badges, an
unavailable tool, property rows, the problems list, and the one-pane
layout on a narrow screen. The host imports `@formancy/themes`'
`workbench.css` first.

The stylesheet takes colour only from the workbench's `--wb-*` variables,
with no colour literal and no fallback. A Studio recolours the editor by
setting those variables, never by overriding a rule. It selects by
`data-report-part`, the `data-*` states and the tree's own ARIA, never by a
framework's class. Its test reads the file and fails on:

- a colour literal;
- a variable the workbench does not define;
- a part or an attribute the builders do not render;
- any class other than the workbench's.

## The editor's words

Every label a builder shows is in `src/text.ts`, in English, Swiss German
and Swiss French: `editorText(locale)` fills one, and `formatZoom` writes a
percentage as the language does. A test fails when the three languages
differ in their messages or placeholders.

The session keeps each step's label as an English sentence ("Delete
Spacer"), which any reader of the session can show: a host's toolbar, a
history view, a proposal's review. Every editor this copy of the package
made also remembers which step each such sentence stands for, and says it
in its own language, so two editors in two languages each read their own.
A copy of the package loaded twice shares no such memory, and each shows
the other's steps in English.

## What it does not do

- **The canvas is not the PDF.** It is a design-mode approximation for
  selecting and placing. A text's height comes from a rule of thumb
  (average character width, 10 pt when no style sets a size). A table is
  drawn as one row of each kind it has. Every region is one flow on one
  sheet, without pagination. The renderer measures text and lays out
  pages, and the PDF preview shows what prints.
- **Not every property is editable yet.** These need editors of their own,
  and have none:
  - a table's sort, its group, its group and total rows, and its footer
    cells;
  - conditional style rules (`styleWhen`);
  - value formats;
  - adding or removing a run in a text, or a column in a columns block or
    a table (a table column can be duplicated and deleted);
  - declarations: styles, datasets, parameters, assets, aggregates.

  Each of these is a report-core command already. What is missing is the
  property kind to edit it.
- **The validator's and the diagnostics' sentences are English.**
  report-spec and report-core word them; a translation keyed by their codes
  is a later step. The one the editor words itself is a length too large
  for the page. The editor's own words are in all three languages.
- **A layout's overflow is flagged, not judged.** A box wider than its column
  is marked, and whether the renderer clips, scales or refuses it is the
  renderer's to say.
- **Two diagnostics about the report as a whole share a name.** An empty
  body and an unused style are both "Warning: Report"; their descriptions
  differ.
- **No measured cost.** Starting a drag asks `validLocations` (one validation
  per place), and every committed edit diagnoses the report again. Neither
  is measured; R04 brings the benchmark.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
