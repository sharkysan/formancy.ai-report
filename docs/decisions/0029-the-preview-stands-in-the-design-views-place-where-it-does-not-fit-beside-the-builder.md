# 0029 — The Preview stands in the design view's place wherever it does not fit beside the builder, as a host's view the editor holds and both builders draw in their middle

- **Status:** accepted
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **report-builder-core.**
    - `src/host-view.test.ts`: an editor made without a host's view has
      none and refuses to show, hide or place one. Made with one, it starts
      hidden, in the middle; made with it shown in the middle, it opens on
      it, so a narrow layout shows it. A view with no name, or in a place
      the editor does not know, throws. Shown in the middle, it takes the
      design view's place and the live region says how to bring the design
      view back, and says it again when the view, shown, comes back from
      another pane a narrow layout showed; shown beside, nothing else
      changes. The toolbar's Design view takes the place back from a view in
      the middle and leaves one beside shown. Placed or hidden as it already
      is, or shown again once it is the pane shown, the state is the same
      object, and placed where it stands no listener hears. While it stands
      in the middle the zoom is unavailable, and asked anyway says why and
      changes nothing; it is the design view's again wherever that is drawn.
      Undo does not touch it, it never reaches the report, and each editor
      over one session has its own.
    - Six new `BUILDER_SCENARIOS`. A host's view takes the design view's
      place, and the toolbar's Design view gives it back. A key pressed in
      a host's view is the host's. A side pane hidden beside it gives it
      the room and the keyboard. Placed beside the builder, it leaves the
      design view in its place. The keyboard goes with the middle pane when
      the host moves its view, and stays anywhere else. The zoom says it is
      the design view's while the host's view stands in its place. A new
      step kind, `host`, dispatches what the host's own control would. The
      core runs them against the model alone (`src/scenarios.test.ts`) and
      each builder with Testing Library, in three languages. The key
      scenario was watched failing in both builders with their guard taken
      out: Ctrl+Z on the host's button undid the report's last edit. The
      keyboard's was watched failing in both with the hand-on taken out,
      and in React with the two middle panes drawn unkeyed, when React
      turned the host's region into the design view's pane and left the
      keyboard on an element no longer focusable.
  - **The builders.** React's `src/host-view.test.tsx` and Angular's
    `src/host-view.test.ts` each hold the view as a bare region in the
    design view's place: the middle pane's `data-pane`, the `view` part, no
    workbench class, and only the host's content in it. That content is
    mounted, or stamped, while the region is drawn and gone with it, and a
    host that gave none gets the region named and empty. React's also
    holds that a key pressed in a portal the host opens from its view, a
    menu in the body, undoes nothing; watched failing with the guard read
    from the page's DOM rather than React's tree. Angular's
    `src/parts.test.ts` takes the parts of two states, since the design
    view and the host's view are never drawn together. The install gate
    draws each packed builder a second time with an editor made with a
    host's view, and `scripts/install-fixture/structure.ts` holds the
    region, its hooks and the host's content in it, and no design view;
    `angular.ts` also checks `ReportHostView` as a directive linked into
    its host. That gate runs in CI's `install` job and had not run when
    this record was written; `structureProblems` was run on each
    builder's drawing in jsdom, and found nothing wrong with either and
    the differences in a drawing without the host's content.
  - **The Studio.**
    - `src/workspace.test.ts`: every editor opens with its Preview shown,
      at the place the window has room for, and every editor the workspace
      holds is placed again as the window crosses the width, until the
      workspace is disposed.
    - `src/studio.test.tsx`:
      - the Preview in the design view's place, in React and in Angular,
        printing an edit made in the properties beside it;
      - the toolbar's Design view taking it out, and the bar's Preview
        bringing it back by keyboard, the keyboard kept on the button and
        the live region saying how to get the design view back;
      - the Preview beside the builder past 2052 pixels, and moved as the
        window crosses 2052 and 2053;
      - in Angular, one Preview drawn at any moment as the window crosses
        2053, and the keyboard on the Preview beside the builder going with
        it into the middle, each watched failing with its fix taken out;
      - each starter keeping whether its Preview is shown;
      - a Preview shown out of sight on a phone, brought into view by the
        bar rather than hidden.

      jsdom has no `matchMedia`, so `src/test-setup.ts` stands one in. It
      answers only `(max-width: Nrem)` and refuses any other query.
    - `src/preview/pdf-view.test.tsx`: the PDF on the paper kept, and
      redrawn, until the newer one is loaded, then let go of, and the last
      one when the paper goes; one still loading let go of when a newer
      arrives. Over a stand-in that throws, as PDF.js's `getPage` does,
      when asked of a document let go of: watched failing on main's viewer
      with that throw. `src/preview/pdf-document.test.ts`: such a page
      asked of the module is a rejected draw, not a throw.
    - `src/styles.test.tsx`:
      - narrow.css gives the builder the row up to the width at which
        `src/layout.ts` stands the Preview in its middle; watched failing
        with either number moved;
      - no rule of workbench.css's, report-builder.css's or the Studio's
        that names the builder reaches inside the Preview there but the
        workbench's `.wb *`, which must declare transitions alone;
      - nothing reaches the paper, beside the builder or in its middle,
        but the paper's own rules and that one.
    - `src/journey.test.tsx` and `src/parity.test.tsx`: axe and a name on
      every control, and the two builders' trees compared, with the Preview
      in the middle and with the design view given back.
  - **The browser gate,** `apps/studio/scripts/gate-place.mjs`, at the
    start of every pass, in both builders:
    - the Preview stands in the builder's middle up to the stylesheet's
      widest breakpoint, with the outline and the properties beside it, or
      as the one pane shown; past it, beside the builder;
    - where the pass is a first viewport, the page does not scroll, and the
      first page's top edge and first line of text are in the window,
      painted on top, on white, with ink;
    - in the middle, the toolbar's Design view and Enter on the bar's
      Preview swap the two, with the keyboard where this record says;
    - no rule of the builder's reaches inside the Preview but the inert
      `.wb *`;
    - past the breakpoint, the window narrowed to 2052 pixels and widened
      to 2053 moves the Preview, printed each time;
    - in the middle, a side pane's Hide, or where the builder shows one
      pane the bar's Preview, pressed by the page the moment an edit's PDF
      is printed and PDF.js still loads it, leaves the Studio standing and
      the PDF redrawn. Watched failing on 18 October 2026 against the
      Studio built with main's viewer, at 1440 and 360 pixels wide: the
      Studio went blank.

    Four light passes, 1366 by 657, 1366 by 768, 1536 by 864 and 1920 by
    1080, run these checks and nothing else. `browser-test.mjs` adds that
    no control of the Preview is cut off by a pane that does not scroll to
    it. `gate-room.mjs` holds 0019's checks of whatever stands in the
    middle. `gate-parity.mjs` prunes the Preview's region, whose text moves
    while it prints, from both trees it compares
    (`scripts/accessible-tree.test.mjs`). The new checks failed against
    main's Studio at formancy.ai/report/ on 18 October 2026, and each guard
    that could pass by accident was broken on purpose and seen to fail.
  - **Measured by the gate on 18 October 2026,** in Chromium 156.0.8078.4
    headless under Playwright 1.64.1 on win32-x64, on the Service
    inspection starter as the Studio opens. The middle pane's width was
    measured by hand the same day, in the same Chromium.

    | Window | Middle pane | Page 1 in view, React / Angular | Fit zoom |
    |---|---|---|---|
    | 641 by 900, one pane | the one pane shown | 329 / 322 of 808 px | 72 % |
    | 1366 by 657 | 684 px | 221 / 214 of 909 px | 81 % |
    | 1366 by 768 | 684 px | 332 / 325 of 909 px | 81 % |
    | 1440 by 900 | 758 px | 464 / 457 of 1010 px | 90 % |
    | 1536 by 864 | 854 px | 506 / 499 of 1144 px | 102 % |
    | 1920 by 1080 | 1238 px | 722 / 715 of 1683 px | 150 % |
    | 2053 by 900, beside | — | 523 of 572 px | 51 % |

    Angular is measured after React's swap, while the builder's live
    region still holds its sentence, a line taller.
  - **What nothing holds.**
    - The packed builders' drawing of a host's view until CI's `install`
      job has run it.
    - A first viewport anywhere from 769 to 1365 pixels, where no pass
      stands.
    - 1366 by 657 as a real browser's window: it is a 1366 by 768 screen
      less an assumed 111 pixels of tabs, address bar and taskbar, measured
      on no browser.

## Context

The rightsholder, on the demo at formancy.ai/report/: "the preview is not
visible on a normal screen?"

[0019](0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md)
put the Preview beside the builder only above 128.25rem, where the design
view, beside the Preview and both side panes, holds an A4 page at 100 %
whole: from 2052px, measured on 16 October 2026. In any narrower window
the Preview stood under a builder as tall as the window less 6rem.
- In a 1440 by 900 window the outline was 304px, the middle pane 758px,
  the design view in it 709px, and the properties 352px. The Preview's
  section began at y=930, under the window, and its first page 1092px
  down.
- In a 1366 by 768 window the section began at y=798 and the first page
  960px down, and the page scrolled 3903px. In a 1920 by 1080 window the
  section began at y=1110 and the first page at 1272, and the page
  scrolled 5475px.

So on the screens most people have, a visitor saw no PDF without
scrolling, and the design view and the PDF were never in view together
there either. Measured on 18 October 2026 at formancy.ai/report/, whose
Studio is main's, in the Chromium named below. The figures the request
came with, a 743px design view and a section at y=1250 in a 1920 by 1080
window, were taken in a window nobody named, and are not used.

0019 rejected design and Preview as tabs, because tabs would take the PDF
away from the editing. But much of the editing is in the side panes: a
text, a field, a style or an amount is changed in the properties, and a
component is inserted and moved from the outline. On 17 October 2026 the
rightsholder chose "Preview in the middle". Below 2053px the PDF stands
where the design view stood, the outline and the properties stay beside
it, and the toolbar's Design view swaps back.

## Decision

**The editor holds a host's view.** A host with a view of its own names it
when it makes the editor: `hostView: { name, shown, place }`.
- The state's `hostView` holds its name, whether it is shown and its
  place. That is `'middle'`, the design view's place, where a builder
  draws it; or `'beside'`, outside the builder, where the host draws it.
- `view` says what the middle pane shows, `'design'` or `'host'`. It is
  decided once, in `state.ts`, and neither builder works it out again.
- `showHostView`, `hideHostView` and `placeHostView` change it. Shown in
  the middle, it becomes the pane a narrow layout shows, and the live
  region says how to bring the design view back, whenever that changes
  what is in front of the person: as the view comes, and as one shown
  already comes back from another pane on a phone, where the keyboard stays
  on the host's control and nothing else would say so.
- The zoom is the design view's. While the host's view stands in its
  place, `can` offers none of it, and `zoomIn`, `zoomOut` and `setZoom`
  are refused, saying why: the toolbar's zoom would change a readout beside
  the host's own and nothing anybody sees.
- `openPanel('canvas')`, which the toolbar's Design view already sends,
  hides a view standing in the middle, and leaves one beside shown.
- It is the editor's, like 0019's hidden panes. No edit or undo touches
  it, and the other builder over the same editor draws the same.

**Both builders draw it the same way.** While `view` is `'host'`, the
design view's pane is not drawn. In its place is a `section` with the
middle pane's `data-pane="canvas"`, `data-report-part="view"`, an
`aria-label` of the view's name, `tabindex="-1"` and no workbench class. It
holds what the host gave, and nothing of the builder's.
- React takes the view as its `hostView` prop. Angular takes it as
  `<ng-template reportHostView>` (`ReportHostView`), which it stamps with
  `@angular/core` alone. Either exists only while it is drawn.
- A key pressed in it is the host's. Each builder leaves keys from its
  view region alone, as it leaves a text field's, and `actionForKey` is
  unchanged. React knows the key by the event the region had first, since
  React bubbles one from a portal the host opens there through the region
  wherever its DOM is; Angular never hears such a key.
- A Hide pressed beside it puts the keyboard on its region, which took
  the pane's room.
- It is its own element, never the design view's pane turned into it:
  React keys the two apart. When the host swaps the middle pane from under
  the keyboard -- its view placed or shown from outside, as a window
  crosses the width -- and the element the keyboard stood on went with it,
  each builder puts the keyboard on what stands in the middle now, rather
  than leave it on the page. Anywhere else it stays.

**The Studio stands its Preview there wherever it does not fit beside.**
- `apps/studio/src/layout.ts` holds the width as a media query, `MIDDLE`,
  `(max-width: 128.25rem)`. It is 0019's measurement, which now decides
  where the Preview stands rather than whether it stacks. narrow.css holds
  the same query, because the browser gate's passes and the pictures'
  camera read their widths from the stylesheet; a test holds the two
  equal.
- The workspace makes every starter's editor with its Preview shown, at
  the place the window has room for. As the window crosses the width, it
  places every editor it holds, not only the one shown.
- The bar's Preview is pressed while the Preview is shown, at every
  width. It hides a Preview in sight and shows a hidden one, and the
  keyboard stays on it. A Preview shown but out of sight, on a phone with
  another pane chosen, it brings into view instead, and the builder's live
  region says so.
- In the middle, the Preview fills the pane and draws the line the design
  view's pane draws beside the properties. Where the pane is narrower than
  its tools, it scrolls rather than cut one off.
- In the Angular builder the Preview is drawn into the element the builder
  lends it only while the editor stands it in the middle, so that moving
  beside the builder it is never drawn twice; the Angular builder takes the
  element back a render after the editor says so. The keyboard on a
  Preview beside the builder goes with it into the middle, onto the
  builder's region.
- The Preview's viewer lets go of the PDF on its paper only once the newer
  one is loaded. A pane hidden or shown resizes the paper, which redraws
  what is on it; let go of as the newer PDF arrived, as main's viewer did,
  the redraw threw and blanked the Studio.
- Below 40rem the page scrolls past the bar to a builder of nearly the
  window's height, as under 0019, and the Preview in the middle scrolls as
  one.
- Past 2052px nothing changes from 0019.

**One rule of the builder's reaches the Preview in the middle, and is
admitted.** workbench.css, in `@formancy/themes` 0.5.0, turns transitions
off under `.wb *` when motion is reduced. Once the Preview stands inside
the builder, that rule reaches every element of it and of its paper, and
changes nothing drawn there. The Studio's stylesheet test and the browser
gate admit that selector while it declares transitions alone, and refuse
any other.

## Consequences

**What it buys.**
- **The PDF in the first viewport** at the screens most people have, with
  the outline and the properties beside it: 332 of the first page's 909px
  at 1366 by 768, 464 of 1010 at 1440 by 900, 506 of 1144 at 1536 by 864
  and 722 of 1683 at 1920 by 1080, nothing scrolled. A property edited
  beside it prints in sight.
- **One press each way, from the keyboard too.** The keyboard stays on
  the bar's Preview, and goes into the design view with the toolbar's
  Design view.
- **The same in both builders and in a host's page.** An integrator's
  builder can stand its own preview in the design view's place, held to
  the same behaviour by the scenarios. A framework switch keeps it,
  because the editor holds it.
- **Nothing printed unseen** while the design view stands, as with 0019's
  hidden Preview: the Preview is not drawn then.

**What it costs.**
- **The PDF or the design view, below 2053px, never both.** Placing a
  component on the design view, or seeing its box drawn, means swapping
  back. The properties, the outline and the keyboard's place chooser still
  work beside the PDF. This is near the tabs 0019 rejected; what it keeps
  is the side panes beside the PDF.
- **The Preview starts over.** It prints again, at its first page, fitted
  to the width, in preview mode, every time it takes the design view's
  place, every time the framework is switched below 2053px (it is drawn
  inside the builder now), and every time the window crosses 2052px. The
  design view loses its scroll position on each swap. 0019's cost for a
  hidden Preview, met more often.
- **A sliver from 769 to about 1000px.** The side panes keep their widths
  down to 48rem, and the middle gets what they leave: the window less
  682px. In a 769px window that is 87px, and the Studio opens there on the
  Preview at 25 %, 114px of its first page in view and six of its seven
  controls reached by scrolling the pane sideways. Hiding a side pane gives
  it room (0019). No pass checks a first viewport there.
- **Larger than real.** Fit width draws the page at 150 % in a 1920 by
  1080 window and 167 % at 2052px. Zoom out is a press away.
- **Phones scroll again.** Below 40rem the page scrolls past the bar to the
  builder, as under 0019: held to the window, the panes had 257px at 390
  by 844 and the paper 28px of it, measured on 18 October 2026. With
  another pane chosen the Preview is out of sight but drawn, and prints on
  every edit. The bar's Preview brings it back with one press; in a
  browser without `checkVisibility` it hides it instead, and a second
  press shows it.
- **Two voices at once.** As the Preview takes the design view's place,
  the builder's live region says how to bring the design view back, and
  the Preview's own status says it is printing. While the builder's live
  region holds that sentence it is a line taller, 7px of the page.
- **Each starter its own.** Whether the Preview is shown belongs to each
  starter's editor. A starter opened for the first time shows its Preview
  after another's was hidden, past 2052px too, where 0019 had one switch
  for the whole Studio.
- **The builder's keys stop at the host's view.** Ctrl+Z, Ctrl+Y, and Ctrl
  with +, - or 0, pressed in the Preview, do nothing to the report or the
  design view, and in React nor do they in a portal the host opens from it.
- **The zoom waits for the design view.** While the Preview stands in its
  place the toolbar's zoom, and Ctrl with +, - or 0 anywhere in the
  builder, say the zoom is the design view's and change nothing. The zoom
  set before is kept.
- **The keyboard follows the middle pane, not the Preview.** A Preview in
  the middle with the keyboard in it, moved beside the builder as the
  window widens, leaves the keyboard on the design view in its place.
- **The Preview's own header.** Laid out as it is beside the builder, its
  heading, status and tools take 185px of the middle at 1366 by 768 and
  1440 by 900, its tools in two rows there, and 141px at 1920 by 1080,
  measured on 18 October 2026. Its heading repeats the region's name. A
  tighter header in the middle would show more of the page and is not
  done here.
- **An admitted rule.** `.wb *` reaches the Preview. A later workbench.css
  that declares more under it fails the Studio's stylesheet test and the
  browser gate, and then the rule needs scoping upstream, or the Preview
  needs to stand outside `.wb`.
- **The width written twice,** in layout.ts and in narrow.css, held equal
  by a test.
- **`aria-controls` that names nothing, for a moment.** The Angular
  builder stamps the Studio's slot one change-detection pass after it
  draws the region, and React draws the Preview into the slot after that.
  Moving out, the region named Preview stands empty for as long, since the
  Studio stops drawing into it as soon as the editor moves the Preview.
- **A short window scrolls.** Under the bar and the builder's 32rem floor,
  which 0019 chose and nobody measured, the page scrolls rather than
  squeeze the panes: by 41px in a 1280 by 585 window.
- **Pictures of the ends only.** The README's pictures show the Preview
  beside the builder, at 2100px, and on a phone, at 390px, never the middle
  layout most screens get. The camera admits a width past the widest
  breakpoint or at the narrowest, as formancy.ai-data 0038's camera
  does.
- **More public API.**
  - In the core: the `hostView` option and `HostViewOptions`; `HostView`,
    `HostViewPlace` and `HOST_VIEW_PLACES`; the state's `hostView` and
    `view`; three actions; the `view` part.
  - In the scenarios: the `host` step, with `ScenarioHost` and
    `HostViewAction`, which every runner of `BUILDER_SCENARIOS` implements.
  - In the catalogue: `status.zoomHidden`, and `status.hostViewShown`
    with the toolbar's name for the design view as `{pane}`.
  - React's `hostView` prop; Angular's `ReportHostView`. An Angular host
    that arranges the parts itself, with `[reportEditor]`, draws its own
    view where `view` says.
- **A longer gate.** Four light passes, and the place checks at the start
  of every pass: twelve passes and 2838 checks took 8 min 10 s on 18
  October 2026, on the machine above, once the paper resized as an edit
  prints was among them. The Studio's jsdom journey walks one
  more state per starter, 47.3 s under coverage where it took 22.2 s on 16
  October.

**What it forecloses.** Nothing that cannot be undone. A host's view
beside the design view inside the builder, a fourth column, would be a
third place.

## Alternatives considered

**Stacking, with a shorter builder,** so that the Preview's top edge is in
the first viewport. In a 1440 by 900 window a builder of half the window
leaves the design view a strip and the Preview another, and reading a page
still scrolls the window.

**The Preview beside the builder, with the side panes hidden** for its
room. At 1440px, computed from the stylesheets and not measured, the
design view beside the Preview holds the page only with both side panes
hidden, and the properties are what a person edits while watching the
PDF.

**A design view fitted to its width, beside the Preview.** At 1536px the
395px design view 0019 measured would draw the page at under half its
size, where a box shorter than its label draws none
(`@container (height < 0.875rem)` in report-builder.css). 0019 kept it as
worth having beside hiding, not instead of it.

**Design and Preview as tabs**, 0019's rejected alternative, and the
nearest to this one. Tabs would take the whole builder away from the PDF;
this keeps the outline and the properties beside it, and past 2052px
changes nothing.

**Studio-only: an overlay over the design view, or the Studio's own CSS.**
It would reach inside the builder, which
[0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)'s
stylesheet test forbids. It would leave the design view in the
accessibility tree under the PDF, break whenever a pane is hidden, and
leave a host's builder without it.

**The host's view as each builder's input, with no editor state.** The
toolbar's Design view is inside the builder, so each builder would need a
callback out, written twice, and the Studio a second copy of the state to
keep in step with it. If the two ever disagreed, nothing would find out
without a test of the copying. With the editor holding it, the framework
switch keeps it and the scenarios drive it.

**Projected content in Angular, `<ng-content>`.** Angular makes projected
content once, whether its slot is drawn or not, so the Preview would live,
and print, while the design view stands. A template is stamped only while
drawn.

**A `'host'` key scope in the core.** A public member for what each
builder already does at a text field: leave the keys alone where they were
pressed. The scenario holds both builders to it without one.

**A toolbar button for the host's view.** Two Preview buttons, one of
them inside the builder putting the PDF in the middle where the Studio has
it beside.

**Keeping the Preview drawn, out of sight, while the design view
stands.** It would print unseen, or need telling to pause. 0019's hidden
Preview prints nothing.

**The width in the script alone.** The browser gate's passes and the
pictures' camera read their widths from the stylesheet's breakpoints; a
width moved out of narrow.css would drop the passes past it silently.

**A box and a line for the view in report-builder.css.** The file is at
598 of its 600 lines, and a split by reason to change needs a new entry in
report-builder-core's `files`. The rule would also be the builder's look
on the host's content. The Studio draws the line on its own element.

**Opening on the design view**, with the Preview a press away. A visitor
would again see no PDF without acting, which is what was asked about.
It is one line in `workspace.ts`.

**The zoom left to the hidden design view**, its cost recorded. The
toolbar read 125 % beside a PDF at 90 %, and the live region said "Zoom
125%." of nothing in sight, found in review at 1440 by 900.

**Two Previews for a moment in Angular**, recorded as a cost. The
Studio draws the Preview beside the builder in the render that moves it,
and Angular takes its element back a render later; one condition on the
portal draws neither twice.

**One Preview switch for the whole Studio**, as 0019 had it. It would be
copied into each editor as a starter is picked: a second state beside the
editor's.
