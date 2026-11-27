# 0090 — A Preview opens a report that carries a QR-bill with its slip in view, and nothing moves the paper after

- **Status:** accepted; numbered while 0084 to 0087 and 0089 were held by another session's branches; extends [0082](0082-the-studio-opens-on-the-invoice-and-lists-it-first-and-the-corpus-keeps-its-order.md), whose cost "the bill a scroll down" it answers wherever the Preview's paper scrolls, and changes the first viewport of [0029](0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)'s browser gate, which held the first page's top edge and first line
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The numbers.** `apps/studio/src/preview/view.test.ts`: a slip is
    report-spec's `QR_BILL_SIZE` high at a zoom; `billZoom` keeps fit
    width where the slip fits what the paper shows, and else gives the
    largest zoom, to the hundredth below, at which it does, never under
    `BILL_ZOOM_FLOOR`, half, and never past fit width; `billScroll`
    scrolls the paper to its end where the slip fits, to the slip's top
    where it does not, and not at all where the paper holds its pages
    whole.
  - **The viewer.** `apps/studio/src/preview/pdf-view.test.tsx`, over the
    PDF.js stand-in, the paper's box stood in by its accessible name: a
    PDF that carries a bill opens scrolled to its end at fit width where
    the slip fits, and at 62 % where it does not, Fit width then not
    pressed, every page drawn at that zoom and a draw begun at fit width
    cancelled; a PDF with no bill, and a paper with no height, open at the
    top at fit width; a later PDF and every zoom leave the paper where the
    person scrolled it; and a zoom chosen before the first PDF arrived is
    kept, the PDF opened at its top.
  - **The pipeline.** `apps/studio/src/preview/pipeline.test.ts`: every
    starter's printed outcome says it carries a bill exactly where its
    report holds a payment part; and the invoice's Swiss QR Code, read
    from the pixels PDF.js draws, and the receipt's and the payment part's
    titles stand below report-spec's `QR_BILL_TOP` on its last page, the
    box the Preview opens on.
  - **In Chromium.** The browser gate's first viewport
    (`apps/studio/scripts/gate-place.mjs`), at every pass `passes()` marks
    one, in both builders, on the invoice as the Studio opens: the
    window does not scroll; the slip's box, from `QR_BILL_TOP` of the
    last page to its foot, is inside what the paper shows of that page;
    every run of text PDF.js lays over the slip is in view; the page is
    painted on top there; the zoom is half or more; the page is drawn on
    white with ink. A light pass at 1280 by 720 joins the four 0029
    named. The whole gate passed on 27 November 2026, in Playwright
    1.64.1's Chromium 156.0.8078.4 on Windows 11: 7,449 checks in 13
    passes from 320 to 2053 pixels wide, the whole journey in 8, every
    one of the slip's 35 runs of text in view at each first viewport,
    the paper at 2053 by 2400 holding the page whole and not scrolled.
  - **Seen failing, on 27 November 2026**, on Windows 11 and Node
    24.21.0. The new cases against the Studio without the change: the
    three of the numbers, their functions missing, and three of the
    viewer's, the paper at 0 where 2600 was asked and no "62%"; the
    viewer's other three hold what it did before, and each failed with its
    own guard planted (below). The gate's first viewport, run through
    `placeChecks` at the eight first-viewport passes from 641 to 2053
    pixels wide, in both builders, against the Studio built without the
    change: 46 checks failed, every slip check at every pass, while the
    window's, the zoom's and the paper's held. Then, with the opening
    decided as the PDF arrived, before its downloads were laid out among
    the viewer's tools: 4, the slip's foot below the view at 1280 by 720
    and 1366 by 657, where those tools wrap onto a second row and take the
    paper's height -- which is why it is decided once the PDF is laid
    out; and none with the change. Then, each planted in the working tree
    and put back byte for byte: the floor taken out of `billZoom`, which
    gave 0.25 where half was asked; its bound at fit width, 0.5 where 0.4;
    `billScroll` always to the paper's end, 600 where 480; the viewer
    deaf to `bill`, which failed the case of a report without one; every
    PDF opening at the bill, which failed the viewer's later-PDF and
    chosen-zoom cases; a chosen zoom not ending the opening; a paper with
    no height opened at the bill; no zoom for the slip; every outcome said
    to carry a bill, which failed eleven starters' case; and the slip
    looked for 200 points lower, which failed the invoice's.

## Context

The Studio opens on the invoice, whose Swiss QR-bill, across the foot of
its one page, is the reason it opens there
([0082](0082-the-studio-opens-on-the-invoice-and-lists-it-first-and-the-corpus-keeps-its-order.md)).
0082 measured that the Preview's first view showed the top of the page and
left the bill below it at 1280 by 720, 1440 by 900 and 1920 by 1080, and
said that opening the Preview where it shows the bill would be a decision
of its own. The person who decides said yes to it: "Das Studio öffnet die
Vorschau so, dass der QR-Einzahlungsschein der Rechnung zu sehen ist."

What decides the Preview's first view is its viewer, `preview/pdf-view.tsx`:
it opens at Fit width, the zoom at which the widest page fills the paper's
width (`view.ts`'s `fitZoom`), with the paper, the region "PDF pages",
scrolled to its top. In every window up to 2052 pixels the Preview stands
in the builder's middle, in the design view's place, so the paper is as
wide as the side panes leave the middle and as high as the window leaves
it under the bar, the builder's toolbar, the Preview's head, the list of
what the preview lacks and the viewer's tools
([0029](0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).
Below 48rem the builder shows one pane at a time and the Preview is the one
it opens on; below 40rem the paper no longer scrolls, the Preview's pane
scrolls as one and the page scrolls past the bar (`styles/narrow.css`).
The viewer is drawn anew whenever the Preview is: a starter opened, the
Preview shown again, the framework switched, the window crossing 2052
pixels (0029).

Measured in the built Studio, served from `dist/` as the README's camera
serves it, in Playwright 1.64.1's Chromium 156.0.8078.4 on Windows 11 and
Node 24.21.0, on 27 November 2026, in the React builder as the Studio
opens, by the page's box and report-spec's `QR_BILL_TOP`:

| Window | Fit zoom | Paper in view | Slip | Slip in view |
|---|---|---|---|---|
| 641 by 900, one pane | 72 % | 305 px | 286 px | none |
| 1280 by 720 | 70 % | 260 px | 278 px | none |
| 1366 by 657 | 81 % | 241 px | 321 px | none |
| 1366 by 768 | 81 % | 352 px | 321 px | none |
| 1440 by 900 | 90 % | 484 px | 357 px | none |
| 1536 by 864 | 102 % | 482 px | 404 px | none |
| 1920 by 1080 | 150 % | 742 px | 595 px | none |
| 2053 by 900, beside | 51 % | 543 px | 202 px | 153 px |
| 2560 by 1440, beside | 51 % | 1083 px | 202 px | all |
| 390 by 844, a phone | 43 % | the pane scrolls | 170 px | none |

So a scroll alone, at fit width, shows the slip whole from 1366 by 768 up,
and cannot at 1280 by 720 or 1366 by 657, where the slip is taller than
what the paper shows; and a whole page fitted into what the paper shows,
less its padding, would be 27 % at 1366 by 768 and the design view's
least, 25 %, at 1280 by 720.

## Decision

**A Preview whose first PDF carries a QR-bill opens with the slip in view,
and nothing moves the paper after.** The pipeline hands on whether the
document carries one, `bill`, from the resolved document's `paymentPart`
(`preview/pipeline.ts`); where it stands is report-spec's `QR_BILL_SIZE`
across the foot of the last page, which the renderer draws it by (0022).
Once that first PDF is laid out, its downloads among the viewer's tools,
the viewer keeps Fit width where the slip fits what the paper shows, and
else opens at the largest zoom, to the hundredth below, at which it does
(`billZoom`), never under half (`BILL_ZOOM_FLOOR`) and never past fit
width; then it scrolls the paper to its end, the slip's foot at the view's,
or, where even half is too large, to the slip's top (`billScroll`). It is
done before the browser paints, by assigning the paper's scroll, so
nothing moves on the screen, no motion is made and no ancestor of the
paper, the window among them, is scrolled. The first PDF of each viewer
alone, and only while the person has chosen no zoom: every later PDF -- an
edit's, Final's -- and every zoom leave the paper where the person put it.
A report with no QR-bill opens as before, at fit width at its top; so does
a paper with no height, drawn out of sight. Nothing in a package changes.

## Consequences

**What it buys.** The invoice's QR-bill is in the Studio's first view,
whole and at half size or more, in every window from 641 to 2053 pixels
wide whose first view the browser gate measures, 1280 by 720 among them.
Measured by the gate's first viewport on 27 November 2026, in the same
Chromium, React and Angular:

| Window | Zoom as it opens | Paper scrolled |
|---|---|---|
| 641 by 900, one pane | 71 % / 70 % | 531 / 527 px |
| 1280 by 720 | 60 % / 58 % | 453 / 438 px |
| 1366 by 657 | 55 % / 53 % | 416 / 400 px |
| 1366 by 768 | 81 % | 597 / 604 px |
| 1440 by 900 | 90 % | 566 / 573 px |
| 1536 by 864 | 102 % | 702 / 709 px |
| 1920 by 1080 | 150 % | 981 / 988 px |
| 2053 by 900, beside | 51 % | 69 px |

Angular's paper is 7 pixels shorter, its builder's live region holding
the sentence React's swap left there (0029). The rule is the document's, not
the invoice's: the payment reminder (0066), the other starter that carries
a bill, opens at its bill too, and so does any report a person gives one.

**What it costs.**

- **The invoice's head out of the first view.** Where the slip fits, what
  the paper shows above it is what stands just above the slip on the
  page: 11 pixels at 1366 by 768, 127 at 1920 by 1080. The firm's mark,
  the customer and the lines are a scroll up, where the bill was a scroll
  down; beside the builder at 2053 by 900, where the slip was three
  quarters in view, the paper opens 69 pixels down, the page's top margin
  and the top of the mark above the view.
- **Smaller than fit width in a short window.** At 1280 by 720 and 1366 by
  657 the page opens at 60 % and 55 % in React, 58 % and 53 % in Angular,
  and Fit width says it is not pressed; and a zoom that is a number is not
  fitted again when a side pane is hidden or the window resized, as any
  zoom a person chooses is not.
- **The first page's top edge no longer checked in a browser.** 0029's
  first viewport held the opening starter's first page from its top edge
  to its first line; it now holds the invoice's slip, so nothing in
  Chromium shows that a report with no bill opens at its top. The viewer's
  jsdom case does, over a stand-in for PDF.js.
- **Opened at the bill again whenever the Preview is drawn anew.** A
  starter opened again, the Preview hidden and shown, the framework
  switched or the window crossing 2052 pixels draws a new viewer (0029),
  which opens the invoice at its bill where it opened it at its top: the
  place a person scrolled to is lost as it was.
- **Not on a phone.** Under 40rem the paper does not scroll, the
  Preview's pane scrolls as one and the page past the bar, so the rule
  moves nothing there: scrolling the pane would take the Preview's
  status and tools out of view, and the window the bar. The README's
  narrow picture leaves the bill below, as before.
- **Fitted once.** What the paper shows is read once the first PDF is laid
  out. A line that changes its height after -- a live region's sentence,
  a window resized -- can leave the slip's foot below the view, and nothing
  fits it again, so that nothing moves under a person who has started to
  read.
- **The pictures.** The README's pictures of the invoice's and the payment
  reminder's Preview, beside the builder at 2100 by 900, were taken again
  by `node scripts/pictures.mjs --scene studio-word --scene
  studio-payment-reminder` on 27 November 2026, each paper opened at its
  slip and the top of the firm's mark above it; their text is the
  record's, and the Studio's `test:pictures` walked all eleven scenes
  after. The other pictures' first views are another starter's, or a
  phone's, and are unchanged.

**What it forecloses.** Nothing the Preview did: Fit width is one press
away, the person's scroll is never taken, and a report without a bill
opens as it did.

## Alternatives considered

**Fit the whole page.** One mode more beside Fit width, and the page's top
and its bill both in view. Rejected: at 1366 by 768 the page would open at
27 %, and at 1280 by 720 at the design view's least zoom, 25 %, where a
10 pt line is 3.3 pixels high; the bill would be in view and not legible.

**Scroll alone, at fit width.** No zoom of its own, and Fit width always
pressed as the Preview opens. Rejected: at 1280 by 720 the slip is 278
pixels in 260 and at 1366 by 657 321 in 241, so its foot would be cut in
the two smallest windows the gate opens.

**Scroll the slip into view with the browser's `scrollIntoView`.**
Rejected: it scrolls every ancestor that can scroll, the window among
them, and on a phone would scroll the page past the bar as it opens.

**The invoice alone, by the id 0082's `OPENS_ON` names, or the Studio's
first Preview alone.** Rejected: the slip's place is the document's, and
a rule keyed to one starter would open the payment reminder below its
bill; once per page would need a state above the viewer, which starts over
whenever it is drawn (0029), as its zoom does.

**Keep the slip in view until the person acts.** Fitting again whenever
the paper's height changes would catch a line added under the tools.
Rejected: the paper would move after its first paint, under a person
reading it, which the request ruled out.

**Find the slip by its words.** PDF.js's text layer holds "Zahlteil" and
"Empfangsschein". Rejected: the words are the report's language's, and the
runtime already says whether a document carries a bill and report-spec
where it stands.

**A control of its own, "Show the QR-bill".** Rejected for now: a tool
more in a row that already wraps in the builder's middle, and the first
view would still be the page's top.
