# 0019 — A person hides the panes whose room the design view needs, and the Studio puts the Preview beside the builder only where the design view holds a page

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **report-builder-core.**
    - `src/editor.test.ts`: `hidePanel` hides a side pane and says so, and
      `openPanel` shows it again. The design view is refused. A narrow
      layout's pane, hidden, gives way to the design view. The hidden panes
      are listed in the order they stand in, and never reach the session.
    - Two new `BUILDER_SCENARIOS`. One hides the outline and shows it again
      from the toolbar. The other hides the properties and the problems and
      shows the problems again. The core runs both against the model alone,
      in its three languages, and each builder runs them with Testing
      Library.
  - **The builders' structure.** The Angular builder's `parts.test.ts`
    holds the root's `data-hidden`. The install gate's
    `scripts/install-fixture/structure.ts` holds both packed builders to a
    Hide in each pane the state shows, named as this record says.
  - **The Studio.**
    - `src/styles.test.tsx` holds each grid report-builder.css draws
      without a hidden pane to `workbench.css`'s own columns, without the
      hidden ones. It was watched failing on a width typed apart from them.
    - `src/studio.test.tsx`: the bar's Preview hides the Preview, nothing
      is printed while it is hidden, and shown again it prints the latest
      edit.
  - **The browser gate,** `apps/studio/scripts/gate-room.mjs`, at every
    pass in both builders.
    - Hiding the outline takes it away and leaves the design view no
      narrower, with the keyboard in it and nothing past either edge.
    - The toolbar's Outline shows the outline again.
    - The bar's Preview hides the Preview, and shows it again, printed.
    - Where the Preview stands beside the builder, the design view holds
      the Service inspection starter's A4 page at 100 % whole.
  - **By hand, in Chromium, on 16 October 2026.** Beside the Preview and
    both side panes, the design view held that page whole in a 2052px
    window and was 2px short at 2049px. In a 1536 by 864 window, the size a
    1920 screen at 125 % gives, it was 395px wide before this record.
    Stacked, it is 839px, 71px short of the page, and 1143px with the
    outline hidden.

## Context

The rightsholder, on the demo at formancy.ai/report/: "the layout is not
perfect, I cannot close areas and see not the editor".

Above 90rem the Studio put the Preview beside the builder, and the
builder's design view took what the outline and the properties left. In a
1536px window, which is a 1920 screen at 125 %, that was 395px for a sheet
846px wide at 100 %. The toolbar's four pane buttons choose the one pane a
narrow layout shows ([0012](0012-the-builders-are-native-and-share-one-session.md)).
At that width they moved the keyboard into a pane and changed nothing that
could be seen. Nothing could be closed.

formancy.ai's workbench has no way to hide a pane either. Formancy Data's
host shows and hides its token tool with a disclosure.

## Decision

**The editor can hide a side pane.**
- `hidePanel` hides the outline, the properties or the problems, and the
  live region says how to show it again.
- `openPanel`, which the toolbar's pane buttons already send, shows a
  hidden pane again.
- The state's `hidden` lists the hidden panes in the order they stand in.
- The design view cannot be hidden, and the pane a narrow layout shows is
  never a hidden one: hiding it shows the design view instead.
- The hidden panes are the editor's, like the selection and the zoom.
  They are not the report's: undo does not bring a pane back, and the
  other builder over the same editor hides the same panes.

**Both builders draw it the same way.**
- Each side pane's header has a button with the text Hide, named after the
  pane as the toolbar names it: Hide Outline, Hide Properties, Hide
  Problems.
- It hides the pane and puts the keyboard in the design view, which took
  the pane's room.
- A hidden pane is not drawn at all. The third column is not drawn when
  both its halves are hidden.
- The root carries `data-hidden`. report-builder.css gives the
  workbench's grid the workbench's own columns without the hidden ones.
  The Studio's test holds them to `workbench.css`, because the core does
  not depend on `@formancy/themes`.

**The Studio's bar has a Preview toggle.** It is a pressed button while
the Preview is shown. A hidden Preview is not drawn and prints nothing.
Shown again, it prints what the session holds then, and the builder takes
the row while it is away.

**The Studio puts the Preview beside the builder only above 128.25rem.**
That is where the design view, beside the Preview and both side panes,
holds an A4 page at 100 % whole. Below it the Preview stands under the
builder, which has the whole width.

## Consequences

**What it buys.**
- **Room on demand.** One press gives the design view a pane's width, and
  the toolbar gives it back. A keyboard does both.
- **A design view worth having at the sizes most screens are.** At
  1536px it is 839px instead of 395px, and the whole page with the
  outline hidden.
- **The same in both builders and in a host's page.** The state is the
  core's and the drawing is held by the scenarios and the structure
  check, so an integrator's builder hides panes as the Studio's does.

**What it costs.**
- **Nothing remembers it.** A hidden pane stays hidden while the editor
  lives. A reload, or a new editor, shows every pane. In the Studio each
  starter has an editor of its own, so a pane hidden in one starter shows
  in the next. A hidden Preview shown again starts over at its first page,
  fitted to the width, in preview mode.
- **Hidden, never resized.** A pane is shown at the workbench's width or
  not at all. The design view's width is what the panes shown leave.
- **The PDF is below the builder on most screens.** Beside it only in
  windows over 2052px. Narrower, the page scrolls to the Preview, where
  before a window from 1441px had both in view with a design view that
  showed a strip of the page.
- **Widths copied from the workbench.** report-builder.css repeats
  `workbench.css`'s column widths for the grids without a pane. The
  Studio's test fails when they part, against the `@formancy/themes` the
  Studio installs, not against a host's.
- **More public API.**
  - `hidePanel`, `hidden` and `HIDEABLE_PANELS` are new in the core's API.
  - `hide-pane` and `data-hidden` are new hooks of the stylesheet's.
  - An Angular host that arranges the parts itself, with
    `[reportEditor]`, draws the Hide buttons itself.

**What it forecloses.** Nothing that cannot be undone.

## Alternatives considered

**Panes resized with a splitter.** More general. But a splitter is a
pointer's control first. It needs a keyboard path (formancy.ai 0046), a
separator's role with arrow keys, and widths that someone remembers.
formancy.ai's workbench has nothing like it. Hiding gives the room in one
press. A splitter can still come later.

**The toolbar's pane buttons as toggles.** One control would mean two
things depending on the window's width: on a narrow screen it chooses the
one pane shown, on a wide one it shows or hides its pane. `aria-pressed`
would say different things at different widths.

**The Studio hiding the builder's panes with its own CSS.** It would reach
inside the builder, which
[0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)'s
stylesheet test forbids. It would also leave a host's builder without the
same thing.

**A design view zoomed to fit its width by default.** It would show the
whole page at any width, but smaller than real, and the panes would still
take their room. Worth having beside this, not instead of it.

**Keeping the Preview beside the builder from 90rem.** The design view
stays a strip on the screens most people have. Hiding panes would fix it
by hand, every time.

**Design and Preview as tabs.** That would take away the PDF beside the
editing, which is what the Studio is for (0013).
