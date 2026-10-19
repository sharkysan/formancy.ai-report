# 0033 — A person adds an image in either builder: report-builder-core reads the file, recognises it from its bytes, checks it as the renderer reads it, cleans an SVG and takes its SHA-256 with @noble/hashes, and the host keeps the bytes through a store given to the editor before the report declares the asset, in one undo step; an image nothing draws is removed from the report's properties; the Studio keeps what is added in the page; a prop on each builder, Web Crypto, a digest from the host and the insert in the same step lost

- **Status:** accepted
- **Date:** 2026-10-19
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format, and the renderer agreeing with it.** report-spec's
    `src/digest.test.ts` holds `assetDigest` to FIPS 180-2's vectors and to
    Web Crypto's digest at every length up to 130 bytes and at a mebibyte,
    hashing exactly the bytes of a view, never the buffer behind it.
    `src/image-header.test.ts` holds `sniffImage` to the bytes alone,
    a UTF-16 or UTF-32 byte order mark taken for an SVG so that 0030's
    cleaner says why it is refused; `imageHeader` to every structural
    refusal the renderer gave before the reader moved, in its words, each
    chunk's CRC to zlib's values and to the definition bit by bit, a PNG's
    image data held in one array however many chunks it was split over,
    the sides at and past `MAX_ASSET_SIDE`, a JPEG's fill byte refused, its
    Exif turn, every orientation from 1 to 8, and to returning a refusal,
    never throwing, on every truncation and on seeded corruptions.
    report-render-pdf's `src/assets.test.ts` passes after the reader moved
    into report-spec, its refusals unchanged, with orientations 2, 4 and 7
    added to its table. report-core's
    `src/commands/declarations.test.ts` holds `nextAssetId` -- the base,
    then `-2`, a base that ends in a number numbered as it stands, the ids
    a builder handed counted as taken, within 64 characters, always an
    identifier, component ids ignored -- and `addAsset`, which refuses an
    id already declared as `already-declared` where `putAsset` would
    replace it, an add one undo step and a refused one changing nothing.
  - **The model.** report-builder-core's `src/images.test.ts`: a file
    recognised from its bytes, never its name or its type; its size refused
    before it is read; the host keeping the bytes before the session
    declares them, and asked once, never again for an undo or a redo; a
    refused or a failed keep changing nothing, the host's error never on
    the page; the same bytes never declared twice; a report that came to
    declare another image under the id while the host kept it refused as
    `changed` rather than an image replaced; bytes the report declares
    already handed to the host again, under the id they are declared by,
    and declared nowhere twice, and bytes declared as another type taken
    for another image; an id the host kept other bytes under never
    handed again, so that two undos cannot declare it over another image's
    bytes, one it refused handed again, and the same bytes chosen again
    after their add was undone given the id they were kept under; a
    second `IMG_4711.png` as `img-4711-2`; a host's refusal without words,
    or in words that are no text, said in the editor's; one add at a
    time, and a disposed editor
    declaring nothing; an SVG kept as `cleanSvg` wrote it, each 0030
    refusal in the editor's words, and a removed name it will not repeat
    in the editor's language; a CMYK JPEG refused in an e-invoice and
    added to any other report; the host's media types; no store, no Add
    image…; a full report; Remove of an image nothing draws in one step,
    and of one something draws refused naming what draws it.
    `src/asset-name.test.ts` holds the id read from a file's name to a
    table of names and to random names, each an identifier
    report-core can number. `src/palette.test.ts`: Insert's Image draws the
    newest image, and says to add one where the host keeps images and the
    report has none.
  - **Both builders**
    ([0012](0012-the-builders-are-native-and-share-one-session.md)).
    The image scenarios join `BUILDER_SCENARIOS`, with a new step, `upload`,
    and a new expectation, `kept`: a PNG added, its add undone by a key
    pressed on its Remove, redone, inserted with Image and both undone; a
    GIF named as a PNG refused; an SVG added as cleaned; the host's refusal
    shown; an image nothing draws removed while one something draws stays,
    and removed again by a redo pressed on its Remove; and no Add image…
    where the host keeps none, with the keyboard held where it should stand
    after an upload, after a Remove, and after an undo or a redo that took
    away the row it stood on.
    The core runs them against the model, and React's `scenarios.test.tsx`
    and Angular's `scenarios.test.ts` run them with Testing Library in three
    languages, with axe at the end of each; an `upload` fails when the
    button opened no chooser or the editor never took the file. Each
    builder's `image-chooser.test` holds, on an input whose `files` and
    `value` behave as a browser's, the file taken before the input is
    cleared, the input cleared, a chooser closed without a file doing
    nothing, the keyboard on the button while the image is added and after,
    Enter -- and in React, Space -- opening the chooser, no chooser opened
    where the editor takes no file, nothing drawn without a store, and the
    host's types offered; each builder's `properties.test` holds the image
    rows, the Remove of one something draws unavailable and described by
    what draws it, and no group where the report has no image.
  - **The Studio**
    ([0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
    `src/images/image-store.test.ts`: the lookup answers by id and digest
    together, keeps a copy of what it is handed, keeps what an undo takes
    back for the redo, and an image added through the editor prints where
    Insert's Image put it, through the preview's own pipeline, read back
    with PDF.js; and, on the e-invoice sample, a CMYK JPEG refused at the
    door, the same image declared and drawn without the editor refused at
    the final render as `unsupported`, and added and printed in a report
    with no e-invoice, so that the editor's rule and the renderer's are
    held together. `src/workspace.test.ts`: every starter's editor is made
    with the one store. `src/studio.test.tsx`: an image added in Angular,
    inserted and printed, both steps undone in React, and redone in Angular,
    printed again, no preview refused on the way. `src/journey.test.tsx`
    audits an image being added and the report's images listed, and
    `src/parity.test.tsx` compares the two builders' trees while an image
    is added, when Add image… is pressed meanwhile, with it listed and once
    it is removed, in three languages over every starter.
  - **The browser gate.** `apps/studio/scripts/gate-images.mjs`, at every
    pass of the journey in Chromium, in each builder: Add image… reached by
    Tab and pressed with Enter, Playwright's file chooser answered, the
    keyboard still on the button and the input's value and files empty
    again; Space opening the chooser again; Image placed, and the Download
    PDF, read back with PDF.js, drawing one image at the left margin at the
    default box's size; both steps undone and the PDF without it, redone
    and with it; an SVG of text refused with what to do, and one with a
    script and metadata added and cleaned; and nothing sent from the first
    press to the last PDF: no request but to `blob:` and `data:` addresses
    and GETs, without a query, of the files the build wrote, and no
    WebSocket, which a request listener never hears of. Its first run, on
    19 October 2026, found the chooser of the first press of all uncaught,
    on the first pass: the wait Playwright starts with a press raced it.
    The gate now catches choosers with one listener set before the first
    press, and passed at all eight passes of the journey the same day, on
    Windows; the README's pictures were retaken by their script and their
    check passed. Its run after review, the same day, found the Angular
    builder naming `stamp-2` the image the React builder had added as
    `stamp` and undone in the same session: the editor counted every id it
    had the host keep as taken, the same bytes' included. It counts those
    kept for other bytes alone now, and the gate passed at all eight
    passes again, and the pictures' check with it. Its check that nothing
    is sent was watched failing on the gate's own image checks with the
    page made to fetch the Studio's own path with a query, and to open a
    WebSocket, each alone, and passing without either.
  - **From outside.** The install gate draws each packed builder a third
    time over an editor made with a store, and `scripts/install-fixture/structure.ts`
    holds Add image… at the palette's end with its hidden input taking what
    the state accepts, and the report's images in a group of a row each
    with its Remove. The Node consumer runs `scripts/install-fixture/images.ts`:
    `assetDigest` from the packed report-spec is node:crypto's SHA-256, the
    runtime hands on report-spec's own readers and limits, and an editor
    with a store refuses a GIF named as a PNG before the store hears of it
    and adds a PNG by its id, digest and bytes, declared in one step only
    then. The gate passed on 19 October 2026 on Windows, at React 19.3.1
    and 19.0.0 and Angular 22.2.3 and 22.0.0; `structureProblems` was
    watched naming the input missing, its `accept` changed, a Remove of an
    image something draws left available, and the rows taken out, on the
    React builder's own server markup broken each way.

  Watched failing, one change at a time, each put back, while this record
  was written. In report-spec: the digest taken of the buffer behind a
  view, upper-case hex, a CRC never checked, the side limit off by one,
  the byte order marks not sniffed, the Exif turn ignored, a PNG with no
  image data accepted, a wrong CRC polynomial; and with report-spec's CRC
  check off, the renderer's own test of a chunk with a wrong CRC, which
  showed the renderer reads report-spec's reader; and, after review, the
  image data held as a view of each chunk, a fill byte read as a marker,
  and orientation 4 taken for a quarter turn, in report-spec and through
  the renderer. In report-core: `addAsset` replacing as `putAsset` does,
  component ids counted, the identifier check gone, a remove that took
  the images drawing the asset with it, and, after review, a base's own
  number stripped and the handed ids ignored. In builder-core, mutations of each branch of
  `images.ts`, among them the size not checked again once read, which
  first passed for the wrong reason until the test pinned the reason, and
  the clean-up after a session that throws, which no test reached until
  one was added for it; and the scenarios, from no "add an image first"
  to a host never asked. After review: the CMYK check off, the bytes
  declared already not handed again, the kept ids forgotten, an id
  counted kept that the host refused, every kept id counted whatever its
  bytes, the media type left out of what the report holds already, a
  host's refusal shown whatever its message, a removed name repeated
  whatever it holds, and in report-core
  a base's number stripped again, which the second `IMG_4711.png` caught;
  and in the Studio, the editor's CMYK check off and the renderer's,
  each failing the agreement alone.
  In both builders: the input cleared before its file was taken, never
  cleared, the chooser opened whatever the editor answered, an add sent
  with no file, the button drawn anew while an image is added, and the
  keyboard not sent to the first field after a Remove, and in Angular
  sent there after a refused one; and, after review, the keyboard left on
  the page by an undo or a redo that took its image row, which both
  builders did; and in the Studio, the lookup answering by digest alone,
  no copy kept, nothing kept, a workspace without the store, and the
  Angular builder without `aria-busy`, which the parity test found while
  an image was being added. In Chromium, React's builder clearing the
  input before taking the file added nothing, and Angular's never clearing
  it left the input holding the file -- where Playwright's chooser, which
  fires a change for any file it is given, the same one included, still
  passed the second choice: so the gate reads the input itself.

## Context

- **The person asked whether a report can carry images and logos, and
  chose three things**: a logo upload in the builders, a logo on the
  starters, and SVG logos. An SVG asset came with
  [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md),
  and the starters' mark with
  [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md).
  Until this record only a host could declare an image.
- **A report holds an asset's id and digest, never its bytes**
  ([0007](0007-a-report-definition-is-its-own-versioned-document.md)), and
  the host's lookup answers for them when it prints
  ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
  So the bytes of an added image must go somewhere the host decides, and
  be there before the report names them: the Studio's Preview re-renders
  on every change of the document, and the runtime's lookup is
  synchronous.
- **report-builder-core has ES2023's library alone**: no `File`, no
  `DecompressionStream`, no `crypto.subtle`. Web Crypto's digest is
  asynchronous and only in a secure context. A pure SHA-256 was in every
  bundle already: `@noble/hashes`', which `@formancy/spec`'s `schemaHash`
  uses and report-spec's `reportHash` calls.
- **The editor's actions are synchronous**
  ([0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)),
  and reading a file and a host keeping it are not.
- **A file a person picks is untrusted**, and what the renderer would
  refuse at every print is better refused when it is added: a host that
  kept a 5000-pixel PNG would have a report refused as `invalid-asset` at
  every print after.

## Decision

- **The host gives `createReportEditor` an `ImageStore`**, its `keep`
  and the media types it keeps. Only then do both builders draw **Add
  image…**, the palette's last button, and a hidden file input beside it;
  the button sends `chooseImage` and opens the platform's chooser in the
  same activation, and the builder hands the file chosen, taken before
  the input is cleared, to **`editor.addImage(file)`**, which:
  1. refuses past report-spec's `MAX_ASSET_BYTES` before reading;
  2. recognises the bytes by report-spec's `sniffImage`, never by the
     name or the type;
  3. reads a PNG or a JPEG by report-spec's `imageHeader` -- the reader the
     renderer used, moved into report-spec with the limits, every chunk's
     CRC and a JPEG's segments to its end marker included -- refuses a
     JPEG of four components in a report with an e-invoice, whose PDF/A
     cannot hold a CMYK image ([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
     and cleans an SVG with `cleanSvg` (0030), the drawing it writes being
     the asset;
  4. takes the digest with report-spec's `assetDigest`, SHA-256 by
     `@noble/hashes` 2.4.0, a new dependency of report-spec at an exact
     version; bytes the report holds already are declared nothing more,
     and go to the host again under the id they are declared by;
  5. names the asset from the file's name, folded to an identifier and
     numbered as it stands by report-core's `nextAssetId`, where the report
     has it or this editor had the host keep other bytes under it;
  6. has the host keep it, and waits for the host to answer;
  7. and only then declares it with report-core's new `addAsset`, which
     refuses an id already declared rather than replace it, in one undo
     step, "Add image".
- **Each step's reason is said in the live region**, in the editor's
  words, and the host's refusal in the host's; the add is one at a time.
- **Insert's Image draws the newest image**, so the one just added is the
  one placed.
- **The report's own properties list its images**, each with a Remove,
  one undo step for an image nothing draws, unavailable and described by
  what draws it otherwise.
- **The Studio keeps every image in the page**, by digest, its lookup
  answering by id and digest, for the tab's life, letting go of nothing.

## Consequences

**What it buys.**
- A person adds a logo without the host's help, in both builders, by
  keyboard or pointer, and the report changes only once the bytes are
  where the host's lookup finds them.
- One reading of an image's header, whether it is added or printed, and
  one digest computation in the format package.
- The digest the runtime would need to check a host's bytes, should a
  later record decide it should.

**What it costs.**
- **Image data is checked only when it prints.** A PNG whose image data
  does not inflate to the scanlines its header promises, or a JPEG whose
  scan is corrupt, is added and kept, and refused as `invalid-asset` when
  it prints: inflating needs a decompressor ES2023 does not have, and
  nothing here decodes a scan. Nor is what a report gains after an image
  is added checked again: a CMYK JPEG added before the report has an
  e-invoice is refused at its final render, as an SVG whose numbers its
  box would carry past what a PDF/A-3 holds always is.
- **The digest runs on the page's main thread.** In Playwright 1.64.1's
  Chromium 156.0.8078.4, headless as `scripts/browsers.mjs` launches it,
  on an Intel i9-10900K under Windows 11 Pro, on 19 October 2026:
  `assetDigest`, on a page of its own -- report-spec's build bundled by
  Vite 8.3.4, served by `vite preview` and timed with `performance.now()`
  through Playwright's `page.evaluate` over random bytes -- took a median
  of five runs of 18.3 ms for 1 MiB, 91.1 ms for 5 MiB and 359.7 ms for
  20 MiB, where `crypto.subtle.digest` on the same bytes took 3.0, 14.5
  and 58.0 ms and gave the same digests. In the Studio's built page,
  served as the browser gate serves it, from the file input's change to
  the live region saying "Added image", read in the page, PNGs of random
  pixels of 1,046,632, 5,237,034 and 19,695,223 bytes, in 8 KiB chunks,
  took medians of three of 37 to 38, 156 to 158 and 482 to 517 ms in the
  React builder and 34 to 35, 156 to 159 and 523 to 565 ms in the Angular
  one, over two runs of the measurement, the digest most of it; the page
  does nothing else meanwhile.
- **The reader walks every chunk.** A person's file can be 20 MiB of
  1,747,622 empty image data chunks, a PNG of one pixel to every reading
  but the inflate. Under Node 24.21.0 on the same machine, the same day,
  `imageHeader` read it in 38 ms and kept nothing of it, where it had
  kept a view of each chunk, 237 MB of heap, in 958 ms; the whole add took
  a median of five of 188 ms, and every render then refuses it as
  `invalid-asset` within 38 to 59 ms. A 19.7 MB PNG of 2,401 chunks, as
  an encoder writes one, is read in a median of five of 97 ms.
- **The host's store only grows.** Undo and redo need the bytes, so
  nothing in the editor says when they may go; Remove takes the
  declaration and leaves the bytes. A host lets go of what no report it
  keeps names and no open session can name again: an undo or a redo in an
  open session declares again an asset a Remove or an undo took.
- **The id the host is handed is the one an add means to declare**, not
  one the report holds yet: an add the host kept may still end
  undeclared, and another editor of the session may declare the id
  meanwhile for other bytes, the add then refused as `changed` with the
  bytes already kept under that id. An editor never hands the host an id
  it had the host keep other bytes under, so one editor alone gives each
  id one image; two cannot know each other's. The runtime checks no bytes
  against their digest, so a host whose lookup answered by id alone could
  print another image unseen: the store keys what it keeps by digest, or
  by id and digest, as the Studio's does, and `ImageStore`'s and
  `AddedImage`'s documentation says why.
- **`keep` must settle.** The editor waits for the host's answer, says the
  image is being added and takes no other meanwhile; a `keep` that never
  settles leaves Add image… unavailable for as long as the editor lives.
  Nothing in the editor cancels it.
- **Bytes the report holds already are handed to the host again** when a
  person chooses the file again, under the id they are declared by: a
  keep of bytes the host may hold, so that a report opened where another
  host kept its images can be given them.
- **The asset's id comes from the file's name, and reaches the report.**
  The extension dropped, letters folded to plain Latin, anything else a
  hyphen, numbered as it stands where the report has the name already:
  `IMG_4711.png` is `img-4711`, and a second one `img-4711-2`, where a
  copied component's number is counted on (`intro-2` copied is
  `intro-3`). A file's name can carry a person's -- a scan named after
  the customer it shows is an id naming the customer -- and the id is in
  the report's JSON, its hash, the outline and the diagnostics, and goes
  wherever the report goes. The editor offers no other id; the file's
  name itself goes to the host's store alone.
- **One image at a time, per editor.** Two editors over one session --
  two people, or one in two tabs -- each add their own; one that would
  declare an id the other declared meanwhile is refused as `changed`, to
  be added again.
- **A dependency of the format package.** `@formancy/report-spec` depends
  on `@noble/hashes` at exactly 2.4.0, which `@formancy/spec` 0.6.0
  brings in at `^2.4.0`, as 0.5.0 did; the Studio's page chunk held noble's
  SHA-256 before, and holds the one copy still. An upgrade of either can
  install two copies.
- **Bytes.** Built by Vite 8.3.4 on 19 October 2026 and set beside the
  build of eb86a4a, before formancy 0.6.0, with the dependency added, by
  their sourcemaps: the Studio's page chunk grew from 722,996 to 751,487
  bytes (240.60 to 250.18 kB gzipped), of which report-builder-core
  21,498, report-spec 4,467, the React builder 1,535, the Studio's store
  392 and report-core 328; the Angular builder's chunk from 164,796 to
  167,706; the Preview's chunk shrank from 1,953,843 to 1,950,417, the
  renderer's reader having moved. That chunk passes `vite.config.ts`'s
  warning limit, as it did before this record.
- **The Studio's memory.** It holds what a person adds in the tab, up to
  the format's limits and no smaller: 64 images of 20 MiB in each
  starter's report, and every image ever added, removed or undone. Nothing
  measured where a tab gives out first; a reload forgets them with the
  sessions.
- **The renderer's reader is in two places**: the structure in
  report-spec, the inflate in the renderer.
- **The builders' stylesheet dresses two more things** without a line
  more: an image's unavailable Remove as the toolbar's unavailable tools,
  and its label as a field's, by widening two of `report-builder.css`'s
  selectors. The rows have no visible heading of their own; the group is
  named "Images" for a screen reader alone.
- **The scenarios read the DOM once**: the file input, hidden and with no
  role, which an `upload` hands its file to. And Space on Add image… is
  proved in a browser alone for the Angular builder, whose jsdom suite
  fires no Space.
- **Retaken pictures.** The palette has one more button, and the README's
  pictures of the Studio were retaken by their script.

**What it forecloses.**
- A builder that reaches the network: the host's store may, in the host's
  own code.
- An asset declared before its bytes are kept.

## Alternatives considered

- **A prop on the React builder and an output on the Angular one.** Two
  bindings of one decision, lost across the Studio's framework switch
  unless the host binds it again, and an editor that would not know
  whether to offer the button.
- **Web Crypto in each builder.** Asynchronous, only in a secure context,
  and written twice; a SHA-256 was in the bundle already.
- **The host takes the digest.** Every host would write it again, and the
  editor would declare a digest it never took.
- **The image inserted in the same step.** Two choosers in a row, a file
  and a place; left until it is asked for. Image draws the newest, so the
  insert is one press away.
- **The whole PNG check in report-spec.** The inflate needs
  `DecompressionStream`, which ES2023 lacks; the chunk walk and its CRCs
  moved, and only the inflate stayed.
- **A sniff in the builder, the sides left to the renderer.** The two
  would decide an image's sides apart, and a picture the host had kept
  would be refused at every print.
- **`putAsset` with a check before it.** The check and the commit are two
  moments; `addAsset` refuses inside the edit, so an image declared
  between them is never replaced.
- **An id the host chooses, or always `image`.** The first asks every host
  for one more callback, the second numbers every logo `image-2`,
  `image-3`; the file's name is what a person recognises, at the cost
  above.
- **Playwright's `setInputFiles` on the hidden input.** It skips the button
  and the activation that opens a chooser, which is what the gate is
  there to see.
