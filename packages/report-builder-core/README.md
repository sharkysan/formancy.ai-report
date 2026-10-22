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

**A host's view.** A host with a view of its own -- the Studio's PDF
preview -- names it when it makes the editor:

```ts
const editor = createReportEditor(opening.session, { hostView: { name: 'Preview', shown: true, place: 'middle' } })
```

The editor then holds whether it is shown and where: `'middle'`, in the
design view's place, where a builder draws what the host gives it; or
`'beside'`, outside the builder, where the host draws it itself. It is
hidden and in the middle unless the option says otherwise. The host says
where there is room (`placeHostView`) and the person whether to see it
(`showHostView`, `hideHostView`); the toolbar's Design view gives the
design view its place back. A view with no name, or in a place the editor
does not know, throws a `RangeError` when the editor is made. Like the
hidden panes it is the editor's: no edit, undo or other editor touches it
([0029](../../docs/decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).

**A host's image store.** A host that keeps the images a person adds
gives the editor its store, and both builders then offer Add image…
(*Images a person adds*, below):

```ts
const editor = createReportEditor(opening.session, {
  images: {
    accept: ['image/png', 'image/svg+xml'], // every type the format draws when absent
    async keep(image) {
      await library.put(image.digest, image.bytes) // keyed by digest
      return { ok: true }
    },
  },
})
```

## The state

`editor.state()` returns one `EditorState`:

- **`document`**: the title, the page in points and in CSS pixels at the
  zoom, and each region with its label and how many components it holds.
- **`outline`**: the regions, then the components in each as a tree, with a
  table's columns under it. Each row has its kind, its id, its depth,
  whether it is selected, how many diagnostics are about it and the worst
  of their severities, and whether it is wider than the space it stands
  in. Its label is what a person calls it: a text by what it prints, a QR
  code by its kind and what it encodes ("QR code: https://…"), an EPC
  payment code by its kind and whom it pays ("EPC payment code: Franz
  Mustermänn"), a bound run by what it binds. Labels are unique in the
  report, so each can be an accessible name; where two would read the
  same, each gets its id.
- **`outlineParts`**: a row for each part of the report's own level, after
  the regions: a report's payment part, its Swiss QR-bill, named as SIX
  names the part ("Payment part", "Zahlteil", "Section paiement"), with
  whether it is selected and its problems, where the report has one
  ([0039](../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)). Every walk of the outline takes it, last.
- **`selection`**: a component, one column of a table, or a part of the
  report's own level, `{ part: 'paymentPart' }` (`REPORT_LEVEL_PARTS`).
- **`palette`**: every kind the format has, with the default component
  inserting it would put in. A new image draws the report's newest asset,
  so the image a person just added is the one Image inserts, else the
  header's image field; with neither, the entry says to add an image with
  Add image… where the host keeps images, and to declare one where it
  does not. Its id comes from `nextComponentId` and its
  size fits the printable area: a QR code's 30 mm square, and an EPC
  payment code's 32 mm, the least in which every payload the EPC allows
  prints with the frame and without, are held to report-spec's
  `squareRoom`, the shorter side. What it
  says -- a new text's "New text", the address a new QR code encodes, the
  name a new EPC payment code pays -- is in the report's language, because
  it prints: two editors in two languages inserting into one report put in
  the same words (`contentLocale`). A new EPC payment code pays `DE36 0000
  0000 0000 0000 00`, the IBAN of bank code 00000000, which no bank keeps:
  every bank code in the Bundesbank's register starts with a digit from 1
  to 8 (read on 17 October 2026), so a code inserted and never edited pays
  nobody. It has no amount, which the payer fills in, and no frame, which
  is Austria's option. Where the report lacks what a kind needs (an image
  with nothing to draw, a table with no detail dataset), the entry says
  what to declare first.
- **`images`**: whether the host gave a store (`store`), so a builder
  draws Add image…; the file chooser's `accept`, each type the store keeps
  and its usual extensions; the name of the file being added, from the
  moment the editor takes it until it has said what became of it
  (`adding`); why Add image… takes no file now, while a store is given and
  it takes none (`unavailable`); and the report's images in its order, each
  with its label ("logo (SVG)"), its Remove's name ("Remove image logo")
  and, when something draws it, what does (`inUse`).
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
  with the room the margins leave: for a QR code's size, `squareRoom`'s,
  against which report-spec measures a square. A QR code's
  content is edited run by run as a text's is, and each of its levels of
  error correction says the share of the code it restores.
  An EPC payment code's fields follow the order the code holds its
  elements (EPC069-12 2.2): the beneficiary, the IBAN, the BIC, the amount,
  the purpose code, the RF creditor reference, the remittance text and the
  note to the payer, then its square and its caption, the code alone or
  Austria's frame with "Zahlen mit Code". Each text is edited run by run,
  one line each, since a line break would end its element of the code; a
  run of several is named by the text it is part of ("Remittance text,
  part 2: Field"). An optional text that is absent, or one literal run, is
  one field: typed into, it becomes that run, and emptied, it is removed,
  as every optional property is, and the code leaves its element empty.
  Whether an IBAN's check digits are right, a BIC goes with the IBAN or a
  reference stands beside a text is report-spec's to say when the edit is
  applied, on the field typed in, in its words, which never quote the
  value.
  A QR-bill's fields are every term of report-spec's `SwissQrBill`, a
  table over them (`payment-part-fields.ts`), in the order the code holds
  them (IG 2.4, Table 8): the IBAN, the creditor, the amount, the currency,
  the debtor, the reference, the message and the billing information, then
  the language of the slip's headings, each named by Intl in the editor's
  language. Each text is edited as an EPC code's is. A party is a group of
  its address's parts, each named after the party ("Creditor's town");
  the debtor is optional, and its group's button removes it, or adds SIX's
  first example's debtor where there is none. The panel's `rows` are its
  `fields` as the form draws them, each by itself or in a group
  (`PropertyGroup`: its key, its name, its fields and its one button, an
  `action` to dispatch); a builder draws `rows` and finds a field in
  `fields`. Where the report has no bill, its own properties end with a
  group "Payment part" whose button is Add QR-bill.
  An IBAN of the other kind than the bill's reference takes the reference
  with it, in the same step, as SIX pays a QR-IBAN with a QR reference and
  nothing else and an IBAN never with one: a QR-IBAN typed over a bill with
  no QR reference gives it SIX's example QR reference, report-spec's
  `QR_BILL_EXAMPLE`; an IBAN typed over a QR reference takes it away; the
  live region says which. A reference the data gives is left as it is.
- **`canvas`**: the design view. It is one sheet as wide as the page, with
  the regions as bands and each component's flow box in its band, in points
  and in pixels, with the same severity and overflow its outline row has.
  It also carries rulers in millimetres. It is labelled as not the PDF,
  because it is not; see *What it does not do*.
  A report with a payment part -- a Swiss QR-bill, which report-spec holds
  at the report's level -- also has `paymentPart`: a band the slip's size
  (report-spec's `QR_BILL_SIZE`, 210 by 105 mm) across the sheet's foot, as
  the slip prints across the foot of the last page, named as SIX names the
  part ("Payment part", "Zahlteil", "Section paiement"). It stands below
  every region, a band's gap under the last of them: when the regions reach
  it, the sheet grows past the page rather than draw them under the slip.
  It says whether the bill is selected, and its problems, as its outline
  row does. Without a payment part it is `null`.
- **`diagnostics`**: report-core's `diagnose()`, each entry linked to the
  component or column it is about, or to the payment part, for one that
  names no component at a path inside `/paymentPart`, with a `key` of what
  it is -- its code, where it points and which characters -- unique in the
  list and the same while it is listed. A bill that holds SIX's examples
  -- an example account, or the creditor, the debtor or the QR reference
  the editor puts in -- is warned of once, there and on no field, until
  each is replaced (`example-payment-part`).
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
  zoom's, by its range -- none while a host's view stands in the design
  view's place, whose zoom it is -- and Add image…'s, by the rule that
  refuses it. A builder marks the others
  `aria-disabled` and still sends them, so the editor says why nothing
  happened.
- **`status`**: the latest announcement for the live region, numbered so
  that saying the same words twice is still two announcements.
- **`panel`** and **`hidden`**: the pane a narrow layout shows, and the
  side panes the person hid to give the design view their room, in the
  order they stand in. The design view is never hidden, and `panel` is
  never a hidden pane, so a narrow layout always has one to show.
- **`hostView`** and **`view`**: the host's view, for an editor made with
  one (its name, whether it is shown, and its place), the same object until
  it changes, so a host that reads it alone redraws only then; and what the
  middle pane shows, `'design'` or, while the host's view is shown in the
  middle, `'host'`. A builder draws the middle pane from `view` and never
  works it out from `hostView` again. An editor made with its view shown
  in the middle starts with `panel` on it.

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
| `select`, `selectNext`, `selectPrevious`, `selectFirst`, `selectLast` | Selects a component, a table column, or with `part` the report's payment part, refusing (`not-found`) what the report does not hold, a `part` that is none of `REPORT_LEVEL_PARTS` among it; the four steps walk the outline's order, the payment part last. |
| `selectParent`, `selectChild` | Steps out to the container a row stands in (a column's table), or into the first thing it holds; says why where there is none, as for the payment part. |
| `moveUp`, `moveDown` | Reorders the selection within its list, a table's columns included. Refused at either end, never clamped, and for the payment part, which prints where SIX puts it, as `indent`, `outdent` and `duplicate` are. |
| `indent`, `outdent` | Moves into the container just before it, at the end of what that holds, or out to just after its own container. |
| `delete` | Deletes, and selects the next item in the list, else the one before, else the container; the payment part in one step, "Remove QR-bill", selecting the outline's row before it. |
| `duplicate` | Copies to just after it with fresh ids, and selects the copy. |
| `insert(kind, target)`, `move(id, target)` | The keyboard path for a drop: a kind, or an id, and a location. |
| `setProperty(key, value)` | Writes one field through a typed report-core command. A refused value keeps what was typed, and shows the reason on that field. |
| `undo`, `redo` | Through the session. |
| `setZoom`, `zoomIn`, `zoomOut` | Clamped to `MIN_ZOOM` to `MAX_ZOOM`; the two steps go through `ZOOM_STEPS`. Refused (`unavailable`), and said why, while a host's view stands in the design view's place: the zoom is the design view's, and would change nothing anybody sees. |
| `startDrag`, `updateDrag`, `drop`, `cancelDrag` | Pointer drag as a state machine. `targetNear` and `targetBeside` turn a pointer position or an outline row into a target. |
| `openPanel` | The pane a narrow layout shows, and a hidden pane shown again. The design view's takes its place back from a host's view shown there; one beside the builder stays shown. |
| `hidePanel` | Hides the outline, the properties or the problems, and says how to show it again; refused for the design view. A narrow layout's pane, hidden, gives way to the middle pane, whatever stands in it. |
| `showHostView` | Shows the host's view. In the middle it takes the design view's place and becomes the pane a narrow layout shows, and the live region says how to bring the design view back whenever that changes what is in front of the person: as the view comes, and as one shown already comes back from another pane a narrow layout showed. Asked of a view that is the pane shown already, nothing changes and nothing is said. Beside, nothing else changes. Refused (`unavailable`) for an editor made without one. |
| `hideHostView` | Hides it, silently: the host's own control says so by its pressed state. |
| `placeHostView(place)` | Moves it between `'middle'` and `'beside'`, shown or not as it was, silently. Placed where it stands, it changes nothing and tells no listener. |
| `chooseImage` | Sent by Add image… before it opens the file chooser, in the same activation. Changes nothing; refused, and said why, when the editor would take no file now: no store (`unavailable`), an image being added (`busy`), or a report that holds `MAX_ASSETS` images (`unavailable`). |
| `removeImage(asset)` | Removes an image the report declares and nothing draws, in one undo step. Refused (`unavailable`) for one something draws, naming what draws it, before the session is asked. |
| `addPart(part)` | Adds a QR-bill to a report without one, SIX's third example (IG 2.4, Table 19), its headings in the report's language where SIX prints in it, else English, in one step, "Add QR-bill", and selects it; refused (`unavailable`) where the report has one, with report-spec's reason where it cannot take one, and (`not-found`) for a part it has none of, which a caller tsc never saw may send. |
| `addGroup(key)`, `removeGroup(key)` | Adds the selection's optional group of fields at `key` from its example values, or removes it, in one step: a bill's debtor, "Add debtor", "Remove debtor". Refused (`unavailable`) with nothing to do. |

`editor.addImage(file)` is no action: reading a file and a host keeping it
take time, and `dispatch` is synchronous (0008). It resolves with an
outcome as `dispatch` returns one, and rejects only with what a listener
threw, once the add is done.

Every pointer gesture has a keyboard path (formancy.ai 0046). `actionForKey`
gives the keys:

- **In the outline:** ↑ and ↓ walk it, ← goes to what holds the row and →
  to the first thing it holds, Home and End jump. Alt with an arrow moves
  up and down, indents and outdents. Delete or Backspace deletes, and
  Ctrl+D (Cmd+D on a Mac) duplicates.
- **Anywhere in the editor:** Ctrl+Z undoes. Ctrl+Y or Ctrl+Shift+Z redoes.
  Ctrl with +, - and 0 zooms. Escape cancels a drag.
- **Text fields** keep their own keys, and the builder does not pass them
  here. Nor does **the host's view**: a key pressed in it is the host's, so
  Ctrl+Z on the Preview's own control undoes nothing of the report.

To choose a place by keyboard, the builder starts a drag with
`via: 'keyboard'` and lists `dropTargets` as buttons. Choosing one is an
`insert` or a `move`.

## Images a person adds

A report holds an asset's id and digest, never its bytes (0007), and a
host's resolver answers for them when it prints (0010). So a host that
lets a person add an image keeps the bytes itself, through the
`ImageStore` it gives the editor, and the report declares the asset only
once the host has kept them
([0033](../../docs/decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
A builder only turns the file a person chose into `editor.addImage(file)`:
a DOM `File` is an `ImageFile` as it stands.

`addImage` takes one file at a time, in this order, and refuses with the
report unchanged and the reason in the live region:

1. **Before the file is read**: with no store, while another is being
   added, in a report that holds `MAX_ASSETS` images, or a file whose size
   is past report-spec's `MAX_ASSET_BYTES` (20 megabytes of 1,048,576
   bytes), so a 2 GB file is never read into the page's memory.
2. **Its bytes**, read and held to the same limit again, are recognised by
   report-spec's `sniffImage`, never by the file's name or a type a
   browser guessed: a GIF named `logo.png` is refused. A type the store
   does not keep is refused.
3. **A PNG or a JPEG** is read by report-spec's `imageHeader`, as the
   renderer reads it: every chunk's CRC, the header, the sides against
   `MAX_ASSET_SIDE`, a JPEG's segments to its scan and its Exif turn. A
   JPEG of four components, which PDFKit draws in CMYK, is refused in a
   report whose e-invoice is a Factur-X invoice, whose PDF/A-3b cannot
   hold one (0031), and added to an XRechnung, whose PDF is a plain copy
   (0038). **An
   SVG** is cleaned by `cleanSvg` (0030), and what the host keeps is the
   drawing it wrote, never the file as chosen; what cleaning removed is
   said, by name, never a value. Each refusal of 0030 says what to do, in
   the editor's words.
4. **Its digest** is report-spec's `assetDigest`, of exactly those bytes.
   Bytes the report declares already, as the same type, are not declared
   again: they go to the host again under the id the report declares them
   by, so that a report whose bytes its host lacks -- one opened where
   another host kept them -- is given them by choosing the file, and the
   live region names the asset that holds them.
5. **Its id** is read from the file's name: the extension dropped, letters
   folded to plain Latin, anything else a hyphen, `image-` before a name
   that does not start with a letter (`Logo Müller AG.svg` is
   `logo-muller-ag`), and numbered by report-core's `nextAssetId`, as it
   stands, where the report has it already or this editor had the host
   keep other bytes under it: a second `IMG_4711.png` is `img-4711-2`. A
   file's name can carry a person's, and the id reaches the report.
6. **The host keeps it**: `keep` is handed the id, the type, the digest,
   the bytes, the file's name and the size it is drawn at. A `{ ok: false }`
   is shown in the host's words, a rejection or any other answer in the
   editor's, so nothing of the host's internals reaches the page. `keep`
   must settle: the editor takes no other image until it does.
7. **Then the report declares it**, through report-core's `addAsset`, in
   one undo step, "Add image". An add never replaces: an asset the report
   came to declare under that id while the host kept the image is left as
   it is, and the add is refused (`changed`).

Undo and redo take and give back the declaration alone, and `keep` is
never called again, so a host keeps what it was handed for as long as a
redo may need it. **Key the store by digest** and answer the resolver by
id and digest, as the Studio does, never by id alone. The id `keep` is
handed is the one the add means to declare, not one the report holds yet:
an add the host kept may still end undeclared, and another editor of the
session may declare that id meanwhile for other bytes, the add then
refused as `changed`. The runtime checks no bytes against their digest,
so a lookup that answered by id alone would print another image unseen.
A host that keeps bytes by digest alone may ignore the id.

What is not checked when an image is added is a PNG's image data, which
needs a decompressor ES2023 does not have, and a JPEG's scan, which
nothing decodes: a picture whose data is corrupt is added, and refused as
`invalid-asset` when it prints. Nor is what the report gains later: a
CMYK JPEG added before the report has a Factur-X invoice is refused at its
final render, as an SVG whose numbers its box would carry past what a
PDF/A holds is.

## What a builder renders

Both builders render the same accessible structure. The scenarios find
everything in it by role and accessible name, and nothing else, but for
the hidden file input Add image… opens, which has no role. Where this
list once left a choice open, the two builders made different ones, and
the review that compared them found each difference only by reading both;
so the choices are made here.

- **The editor's root:** a `region` named `editor.label`, with
  `data-report-part="editor"`, the workbench's `wb` class, `data-panel`
  set to the state's `panel`, and, while any pane is hidden, `data-hidden`
  set to the state's `hidden`, space-separated. Its children, in order:
  - a bar holding the report's title (`data-report-part="title"`) and the
    toolbar;
  - the outline pane (`data-pane="outline"`): the palette, then the tree,
    with the place chooser floating over them;
  - the design view's pane (`data-pane="canvas"`, also `wb-canvas`), or,
    while the state's `view` is `'host'`, the host's view in its place;
  - the third column, whose `data-pane` is `diagnostics` while that is the
    panel and `properties` otherwise; its properties half and its problems
    half each carry their own `data-pane`;
  - a bar holding the live region.

  Each pane has the workbench's `wb-pane` class, and so do the bars, which
  stand in no pane: `report-builder.css` spans every child that is no pane
  across the columns, so on a narrow screen neither bar is hidden. A pane
  in `hidden` is not drawn at all; the third column is not drawn when both
  its halves are hidden, and says it is `diagnostics` when only its
  properties are.
- **A Hide in each side pane's header:** a button with the text
  `action.hide`, named `action.hidePane` with the pane's name (Hide
  Outline, Hide Properties, Hide Problems, as the toolbar names the panes),
  with `data-report-part="hide-pane"`. It dispatches `hidePanel` and puts
  focus on the design view, or the host's view standing in its place, which
  took the pane's room; the toolbar's button for the pane shows it again.
- **The host's view:** while `view` is `'host'`, a `section` in the design
  view's place with `data-pane="canvas"` and `data-report-part="view"`,
  named `hostView.name` (`aria-label`), `tabindex="-1"` so focus can land
  on it, and no workbench class: no rule of `report-builder.css` reaches
  what is in it, and of `workbench.css`'s only `.wb *`, which turns
  transitions off when motion is reduced and reaches every element under
  the root (0029). It holds what the host gave the builder and nothing of
  the builder's, drawn only while it stands there -- its own element, never
  the design view's pane turned into it -- and a key pressed in it is the
  host's. The host's view fills the box itself and scrolls inside itself;
  a host that names a view gives one, and one that gives none gets the
  named region, empty. When the host swaps the middle pane from under the
  keyboard -- its view placed or shown from outside, as a window crosses a
  width -- and the element the keyboard stood on went with it, focus goes
  to what stands in the middle now; anywhere else the keyboard stays.
- **A toolbar:** `role="toolbar"` named `toolbar.label`, one tab stop, the
  arrow keys, Home and End moving between its buttons the way the page
  reads (→ is the previous tool under `dir="rtl"`); an arrow held with
  Ctrl, Alt or Cmd is left to the browser. It holds buttons named Undo,
  Redo, Move up, Move down, Indent, Outdent, Move to…, Duplicate, Delete,
  Zoom out, Zoom in and Actual size, with an `<output>` named Zoom showing
  `zoomLabel` (`aria-live="off"`, because the live region says it), and
  four buttons named after the panes -- Outline, Design view, Properties,
  Problems -- each dispatching `openPanel` and taking focus into its pane,
  which shows it again if it was hidden.
  A tool with nowhere to go (`can`, `history`) is `aria-disabled`, stays
  focusable, and is still sent, so the live region says why; Move to… with
  nothing but a table's column selected opens nothing.
- **The palette:** a group named `pane.palette`, with one button per entry
  named by its label. An entry with no component is `aria-disabled` and
  described by its `unavailable` sentence. Activating one starts a keyboard
  drag of its kind. Where `images.store` is true, one more button stands
  last in the group, named `images.add` by its text, with
  `data-report-part="palette-item"` and no `data-kind`: Add image…, which
  starts no drag. It is `aria-disabled` and described by
  `images.unavailable` while `can.addImage` is false, and `aria-busy="true"`
  while `images.adding` is set. Beside it stands an `<input type="file">`
  with `hidden` and `accept` set to `images.accept`, outside the
  accessibility tree, and never given focus. Activating the button
  dispatches `chooseImage` and, when that is ok, calls the input's
  `click()` at once, in the same activation, which opens the platform's
  chooser; awaiting anything first would lose the activation. On the
  input's `change`, the builder takes `files[0]` into a local first, then
  clears the input's `value` -- in a browser, clearing it empties `files`
  -- so that the same file can be chosen again, and hands the file to
  `addImage`. A chooser closed without a file does nothing. Focus stays on
  the button throughout.
- **The place chooser:** while `drag.via` is `'keyboard'`, a dialog named
  `drag.title`, floating over the outline pane, which `openPanel` shows. It
  holds a button per drop target named by its label, and a Cancel button.
  When the builder opens it, focus goes to the first place, or to Cancel
  when there is none, and the dialog is then described by `drag.nowhere`;
  a chooser the builder only draws -- the drag is the editor's, so one
  opened in another builder over the same editor outlives it -- leaves
  focus where it is. The place a button stands for is marked on the canvas
  while the button has focus. Choosing a place moves focus to the selected
  outline row; Cancel and Escape move it back to what opened the chooser,
  or, when another builder opened it, to the palette entry of what is
  being placed, else the selected outline row, else the tree.
- **The outline:** `role="tree"` named `pane.outline`, with a group per
  region named by its label. Each row is a `treeitem` named by its label,
  with `aria-level` set to depth + 1, `aria-posinset`, `aria-setsize` and
  `aria-selected`, described by its problem count and, when it overflows,
  by `canvas.overflow`. After the regions' groups, at the tree's top, a
  row for each of `outlineParts` -- the payment part -- at `aria-level` 1,
  its place among them its `aria-posinset` and `aria-setsize`, selected by
  focus or a click as a component's row is, dragged nowhere. One row is a
  tab stop -- the selected one, else the first. With no row in any region the tree is empty -- a tree owns rows,
  and a region's name with none under it is not one -- and is itself the
  tab stop, described by `outline.empty` in a paragraph beside it
  (`data-report-part="outline-empty"`). Focus and selection are one: focus
  moving to a row selects it, and every action that selects moves focus to
  its row. An action in the outline that leaves nothing selected -- an undo
  of an insert -- moves focus to the tree itself, never to a row, which
  would select itself and give the next Delete something nobody chose.
- **The properties:** a `form` named by `properties.heading`, one native
  control per field, labelled by the field's label, with the role
  `PROPERTY_ROLES` gives and `required` where the field is. A text field
  commits when it changes (on blur, or Enter in a single-line field), and
  Escape gives back what the report holds. A refused value sets
  `aria-invalid="true"` and an `aria-describedby` pointing to the visible
  error. While something is selected, a button named `properties.report`
  above the form selects nothing and takes focus to the first field: the
  way back to the report's own properties. The form draws the state's
  `rows`: a field by itself, or a group of them, a `group` named by its
  `label` (`aria-label`), with `data-report-part="property-group"`, its
  label drawn in a `span` hidden from the tree, its fields' rows, and its
  `action`, where it has one, as a button after them named by its label,
  which keeps the keyboard as its words change, Add to Remove and back.
  Add QR-bill takes its own button away with the report's properties, and
  the keyboard goes to the first field, the bill's IBAN, as it does when a
  Remove takes its row. While nothing is selected and
  the report declares an image, a group named `images.heading` follows the
  fields in the form -- named for a screen reader, with no heading drawn --
  with one row per image of `images.assets`, `data-report-part="property"` and no
  `data-kind`: its label as text, not a `<label>`, and a Remove button whose
  text is `images.remove` and whose name is its `removeLabel`. A Remove
  whose image something draws is `aria-disabled` and described by its
  `inUse`, and still sends `removeImage`, so the live region says why. A
  Remove that removed its image takes its own button away, and focus goes
  to the first field, as the way back to the report's properties does; so
  does an undo or a redo that takes away the row the keyboard stood on --
  an image's add undone, its Remove redone -- which would otherwise leave
  the keyboard on the page.
- **The problems:** a `status` named `pane.problems` whose text is the
  name and, when there are any, their count ("Problems 2"), so a change in
  the count is announced; then a list named `pane.problems`, with one
  button per diagnostic named by its label and described by its message.
  Activating one selects what it is about and focuses that outline row.
  Each entry is keyed by its `key`, so a problem listed before the one the
  keyboard is on leaves the keyboard on the problem it was on.
- **The canvas:** a region named `canvas.label`, one tab stop so a
  keyboard can scroll it, with the note that says it is not the PDF. Each
  box is an `img` named by its label; a click selects it and moves focus to
  its outline row. While something is placed, each drop target is drawn as
  an `img` named by its label. A pointer reads its position from the
  sheet's padding edge, inside its border, as the targets are placed. A
  payment part's band is an `img` named by its label, after the boxes,
  with `data-report-part="payment-part"`, and its label drawn in it as a
  region's band draws its own (`region-label`); `data-selected` and a badge
  as a box's, and a click selects the bill and moves focus to its outline
  row.
- **A live region** (`role="status"`, unnamed) showing `status.text`, each
  announcement a new element.

**A name the builder gives is in the editor's words**, as `aria-label`:
the region, the toolbar, a region's group, the form, the problems' count
and list, the place chooser and the canvas. Never `aria-labelledby` after
text on the page: Chromium puts a stylesheet's `text-transform` into a name
it takes from text, and `report-builder.css` draws a region's label in
capitals, so a group named after its label was "BODY" in Chromium where the
other builder's was "Body". Where the same words are drawn inside what
they name, as a region's label is in its group, they are hidden from the
tree, which would read them a second time. A control named by its own text
-- a button, a row, an option -- and a field named by its `<label>` are
named as HTML names them.

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
problems as they change, press a tool with nothing to do, zoom, choose
a style, open a report with a payment part, whose band is drawn and
which an edit, and a page refused for it, leave whole, select the QR-bill
by its band and edit it field by field -- an IBAN with a wrong check digit
refused on its field, one typed, its debtor added from SIX's example,
renamed, removed and brought back by Ctrl+Z -- add a QR-bill to a report
without one, follow its warning, delete it from its row and bring it back,
add one and make it pay a QR-IBAN, its QR reference taken with the IBAN
and then typed, and insert an EPC payment code by keyboard, its IBAN refused on its field
when its check digits are wrong, and its BIC added by typing it and
removed by emptying it. Six are about a host's view: it takes the design view's place with
the outline and the properties beside it, and the toolbar's Design view
gives the place back; a key pressed in it is the host's; a side pane
hidden beside it gives it the room and the keyboard; placed beside the
builder it leaves the design view where it is; the keyboard goes with the
middle pane when the host moves its view, and stays anywhere else; and the
zoom says it is the design view's while the host's view stands in its
place. Their editor is made with
the scenario's `host`, the runner gives the builder one button as the
host's view, and a `host` step dispatches what the host's own control
would. Others are about images: a PNG added, its add undone with the
keyboard on its Remove and the keyboard then on the first field, redone,
inserted with Image and both undone; a GIF named as a PNG refused; an SVG
added as cleaned; the host's refusal shown; an image nothing draws removed
while one something draws stays, and removed again by a redo pressed on
its Remove; and no Add image… where the host keeps none. Their editor is made
with the store `scenarioStore` gives the scenario (`store`), which keeps
each image or refuses each, and records what it kept for a `kept`
expectation. An `upload` step clicks Add image… and hands the scenario's
file to the input beside it -- the one element a runner finds by reading
the DOM, since a hidden input has no role -- with no filter of `accept` in
the way, and fails when the editor never took the file. The files are
bytes in the package: `SCENARIO_PNG`, a 2 × 1 PNG whose digest is pinned as
`SCENARIO_PNG_DIGEST`, taken by `node:crypto`, so the first scenario holds
`assetDigest` to it; a GIF; and an SVG.

Each framework's test runs every scenario with Testing Library, and fails
when one is skipped. The scenarios use every kind of step, so each runner
has to implement every kind. `builderScenarios(locale)` gives the same list
in German and French. The names come from the catalogue and from the
scenario report's own text.

Here the scenarios run against the model alone, through a headless reading
of the contract above. That shows every name they look for is one the
state gives. Focus, roles and what is visible are for the framework runs to
show.

Where the scenarios stop, the two builders' whole accessible trees are
compared with each other, in the Studio
([0012](../../docs/decisions/0012-the-builders-are-native-and-share-one-session.md)):
side by side over one editor in jsdom, in all three languages, at each
state of a walk by the editor's own actions (`apps/studio/src/parity.test.tsx`);
and in Chromium, in the Studio's browser gate, for every starter at each
state the same steps bring each builder to, as Playwright's snapshot and
as Chromium's own tree read them (`apps/studio/scripts/gate-parity.mjs`).
A difference either finds is fixed in the builder that is wrong, or made a
rule here; those it found are the naming rule above and the problems' key.

## The stylesheet

`@formancy/report-builder-core/report-builder.css` dresses what is specific
to reports: the bars above and below the panes, the sheet, its region
bands and a payment part's band, rulers, the selection, drop indicators,
outline rows, badges, an unavailable tool, property rows and groups, the
problems list, the grid without the panes the person hid, and the one-pane
layout on a narrow screen. The host imports `@formancy/themes`'
`workbench.css` first. It dresses nothing in a host's view, which is the
host's.

It is one entry, the export's name, which imports its rules from
`styles/` beside it, a file per reason to change -- the editor's frame, the
outline, the design view, placing, the properties and the problems -- in
the order they cascade in; the package publishes them. A bundler inlines
them, as Vite, esbuild and the Angular CLI do; a page that links the entry
as it stands asks the browser for each file beside it.

The stylesheet takes colour only from the workbench's `--wb-*` variables,
with no colour literal and no fallback. A Studio recolours the editor by
setting those variables, never by overriding a rule. It selects by
`data-report-part`, the `data-*` states and the tree's own ARIA, never by a
framework's class. Its test reads the entry with its imports resolved,
and fails on a part it does not import, or one it imports that is not
there, and on:

- a colour literal;
- a variable the workbench does not define;
- a part or an attribute the builders do not render;
- any class other than the workbench's;
- a rule that dresses a region's band and not a payment part's, which is
  drawn as one;
- a rule that dresses a selected box, or a box's badge, and not the
  payment part's band, which a click selects as it does a box.

## The editor's words

Every label a builder shows is in the catalogue, in English, Swiss German
and Swiss French, a file for each (`src/text-en.ts`, `src/text-de-ch.ts`,
`src/text-fr-ch.ts`) that `src/text.ts` puts together:
`editorText(locale)` fills one, and `formatZoom` writes a
percentage as the language does, by Intl, as the share a QR code's level
restores is written. A test fails when the three languages differ in their
messages or placeholders.

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
  drawn as one row of each kind it has. A QR code and an EPC payment code
  are drawn as the square each prints, with no modules in it, and no frame
  or caption. Every region is one flow on one
  sheet, without pagination. The renderer measures text and lays out
  pages, and the PDF preview shows what prints.
- **A payment part's texts are edited, not its slip drawn.** The editor
  opens a report with one, keeps it whole through every edit but its own
  and undo, and refuses a page it cannot be printed on, Letter, landscape
  or a top margin past the slip's top, with report-spec's reason on the
  field. A page header, or the instruction to separate above the slip,
  reaching into it is refused only when the report renders, since only a
  render measures them. The design view shows where its slip prints and
  draws nothing of the slip, which the PDF preview shows. Its fields edit
  its texts run by run, as a payment code's, and nothing else: a debtor
  bound to the data, removed and added again, comes back as SIX's example
  in literal text, bound again only by undo. Nothing confirms a changed
  IBAN: report-spec's rules refuse one of the wrong country, length or
  check digits, SIX's examples are warned of, and a valid account of
  someone else's is taken. In a report with an e-invoice the bill's IBAN
  must be the e-invoice's account, and an edit of either alone is refused
  on its field ([0039](../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
- **Not every property is editable yet.** These need editors of their own,
  and have none:
  - a table's sort, its group, its group and total rows, and its footer
    cells;
  - conditional style rules (`styleWhen`);
  - value formats;
  - adding or removing a run in a text, a QR code's content or an EPC
    payment code's text, a text of several runs or a bound one included
    (only an optional text that is absent or one literal run is added by
    typing it and removed by emptying it), or a column in a columns block
    or a table (a table column can be duplicated and deleted);
  - declarations: styles, datasets, parameters, aggregates, and of assets
    all but an image a person adds and the removal of one nothing draws.

  Each of these is a report-core command already. What is missing is the
  property kind to edit it.
- **The validator's and the diagnostics' sentences are English.**
  report-spec and report-core word them; a translation keyed by their codes
  is a later step. The one the editor words itself is a length too large
  for the page. The editor's own words are in all three languages. So an
  EPC payment code's square refused as too small for its frame is said in
  points, as report-spec says it, in a field edited in millimetres.
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
