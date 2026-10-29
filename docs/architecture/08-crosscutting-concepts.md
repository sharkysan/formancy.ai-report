# 8. Cross-cutting concepts

Concepts that run through more than one building block, and that a reader
needs in order to follow any of them.

## 8.1 Exact values

A decimal or a large integer travels as a string with its type and never
passes through a JavaScript number, as in Formancy Data
([formancy.ai-data 0008](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0008-exact-values-travel-as-strings.md)).

| Where | How |
|---|---|
| Data in | A decimal only as a canonical string within its field's scale, never a number; an integer as digits or a safe integer ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| A formancy number | A double already in the submission, turned into digits once and never the reverse: a safe integer's digits, or, nearer zero than 2^53, the shortest decimal that is the double when it has at most 15 significant digits, which every decimal of at most 15 significant digits a person typed comes back as, and refused as `inexact-number` otherwise, never rounded; a property test holds the 15 digits rather than a citation. A number typed with more digits was rounded when formancy stored it, and prints as that double where its shortest decimal is short ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)) |
| Expressions | Each member bound as what it was checked as: an integer a `bigint`, a decimal upstream's `Decimal` ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). A double literal, `double()` and `/` are errors where they are written, because upstream hands an integer and a double back alike: `3 / 2` printed 1 |
| Totals | Computed exactly and rounded once, to the exact total, as declared: each group's and the report's apart, so rounded subtotals need not add up to the rounded total ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Printing | Intl is handed the exact digits, already rounded half away from zero to the places shown. A format that would round a rounded total again is a diagnostic ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| A payment code's amount | A QR-bill's and an EPC QR code's alike: written from its own digits and never rounded; a third decimal is refused, so rounding stays where the total is computed. An EPC QR code's is written as short as it can be, as Austria's PSA asks ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| An e-invoice's totals | Computed once, in `Decimal`, from the very values the table prints: each VAT category's tax is its basis times its rate over 100, rounded once, half away from zero, and never per line; a line's net amount and a paid amount are whole cents, refused rather than rounded, and a net amount other than its quantity times its net price rounded once is refused; a rate is compared by value, so `19` and `19.00` are one rate. The XML writes each amount from its own digits at two places, and the page reads the totals by name, so that it prints what the XML holds ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) |
| Lengths | Points, on the hundredth of a point; a finer one is refused, not rounded, so one layout has one stored value and one hash ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |

## 8.2 Refusals

A refusal says what stopped the work and where, and the work leaves nothing
half done behind it. Each layer has its own kind:

| Layer | A refusal is | And leaves |
|---|---|---|
| Format | A validation error: a stable code, a JSON Pointer, the component it is inside | No hash for an invalid report ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| Editing core | A command's `Refusal`, with a stable code | The session as it was, its listeners unnotified ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)) |
| Diagnostics | An error or a warning on a valid report, at the component and the column it is about | An error is what the runtime would refuse; a warning renders as written ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| Runtime | Every reason, each with the stage that found it, a stable code and a JSON Pointer | No document ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Renderer | A `RenderRefusal`: `too-many-pages`, `content-too-large`, `invalid-asset`, `cancelled` or `unsupported`, naming the block, table or asset | No PDF ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| Provider | Every reason, each with a JSON Pointer | No data ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| Form bridge | Every reason, each with a stable code and a JSON Pointer into what was handed over or into the report, a field the version cannot fill naming the field and the version's hash | No data ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)) |
| Report generator | Every reason, each with a stable code and a JSON Pointer into the form or the options: what the format or the page cannot hold, or a label no font draws, by its place, never cut to fit | No report, and no notes ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)) |
| Form review | Every reason, a stable code and a JSON Pointer, a version the report names missing by its hash; and a resolution the session refuses -- stale, leaving a report the validator refuses, or a step of a batch that throws on what the steps before it left -- refused whole as any edit is | No review; the report as it was, its listeners unnotified ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)) |

**Fail closed** is upstream's rule, and every reader here inherits it
([formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).
A version, a component kind or a property a release does not know is refused
whole, never skipped: the field ignored could be the one that hides a row or
changes a total ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)).
So 0.1.0 refuses a report with a QR code, a payment part, an EPC QR code,
an e-invoice or an SVG asset, though each is an addition to the same draft
version
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
[0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md),
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
[0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
An SVG construct the cleaner's tables do not name is refused, named, never
dropped: a construct nobody decided about is one a browser may draw and
the converter not (0030).
And the renderer refuses an e-invoice whose file it does not know, whole,
rather than embed it as something else or draw it as a plain PDF without
the XML that, in Germany, is the invoice (0027), and a Factur-X invoice
that its PDF/A-3b cannot hold, a CMYK JPEG or a title its XMP cannot
write, rather than draw a PDF that says it is a PDF/A and is not one
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md));
an XRechnung's plain PDF it draws only as its copy, labelled so (0038).

**A code is read from a closed list.** An e-invoice's units, countries, VAT
prefixes and schemes are lists someone chose (`UNIT_CODES`,
`COUNTRY_CODES`, `VAT_PREFIXES`, `SCHEME_IDS`), narrower than CEN's and held
to CEN's by the e-invoice gate. A code outside them is refused, though CEN
might take it, because a check of the code's shape would pass `UK` or
`Stk`, which every validator refuses, and only after the render was called
final (0027). An electronic address's scheme is one of `ADDRESS_SCHEMES`,
five codes of the CEF's list, held to BR-CL-25's list and FeRD's the same
way
([0037](../decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)).

**A shape another validator warns of is its own expression.** Where
report-spec holds a text to a shape a validator only warns of -- a
contact's telephone number and email address, XRechnung's BR-DE-27 and
BR-DE-28 -- the shape is the validator's expression as its schematron
writes it, read as XPath reads it, and the e-invoice gate holds the string,
the test that reads it and the rule's context to that schematron on every
run; a shape of its own would refuse or take what the validator does
otherwise, and nobody would see the two part. Where the expression run as
written would take time that grows with the square of a text's length, as
BR-DE-27's does, report-spec runs what it asks, a count of digits, and a
test holds the two equal on every short text. That the validator takes
the file was not judged until a file was one it reads in that scenario
(0037); the XRechnung sample is, and KoSIT's XRechnung scenario takes it,
the rules an XRechnung needs, and those report-spec holds by the format,
held the same way, each to its rule's context and test ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).

**A message never quotes a value.** A refusal names the field, the rule and
the place, never the text that broke it: the data and the bill are the
customer's ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md),
[0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
An EPC QR code holds a name, an account and a reference, so its rules say a
length and a character's position, never a character; `invalid-epc-qr-code`
names the code, the field and the rule, from the validator and the runtime
alike; and the renderer names the code by its id, never its payload (0025).
A string written where a payment code expects runs is refused unquoted,
where the shared readers quote what they find (`validate-payment-text.ts`).
An e-invoice holds names, addresses, accounts and VAT identifiers, so
`invalid-e-invoice` names the business term and the rule, never the value,
and the renderer's refusals of an e-invoice never quote its XML (0027).
An SVG's refusal names the element path and the construct, and what
cleaning removed a kind, a name and a count: a link's address, a script's
text and a style's content are never repeated, and a name is repeated
only when it is short ASCII, so neither grows with what a file holds
(0030).

## 8.3 Final and preview

A **final** render is the report: it refuses what the data lacks, data the
provider calls incomplete, and a captured count that differs from the rows
given. A **preview** runs on what it has: it prints nothing for a missing
value and warns once per field, and when it lacks anything it labels every
page as a preview of incomplete data and says so in its manifest, so it
cannot pass for the report
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
The label is English, whatever the report's locale.

A code does not carry the page's label. A QR code in a preview encodes what
its content resolved to, and can scan to a shorter reference than the final
one ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
a QR-bill that breaks SIX's rules is refused even in a preview, because it
would scan as a bill no bank pays
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
So is an EPC QR code that breaks the EPC's rules. A preview that lacks the
values of a text the EPC requires prints that text as nothing, so its code
is refused, saying the preview had no value for it. An optional text of that code which the
data gives empty, blank or null is not missing: its element is left unused,
in a final render as in a preview, because a nullable field's null is how
data says "none"
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

An e-invoice is not written by a preview. Its XML is the invoice, so a
preview writes none, warns `e-invoice-preview`, and labels every page,
complete data or not: "Preview: not an e-invoice, and not a final report",
or a preview of incomplete data's label where it lacks something. A final
render writes the XML or refuses
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
and the renderer draws a final render as the PDF/A-3b that embeds it, and
a preview as a plain PDF that embeds nothing
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).

## 8.4 Untrusted input

Templates, expressions, datasets, fonts and images are untrusted even when an
administrator wrote them ([`SECURITY.md`](../../SECURITY.md)).

| Input | How it is read |
|---|---|
| A report | Read once, through property descriptors, so a getter never runs and a proxy that throws is refused; every array, string and number bounded by a constant with its reason in `limits.ts` ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)) |
| An expression | CEL, typed member by member, within a step budget each and a step budget a render; no clock, no randomness, no `matches()`, whose time no budget bounds ([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Data | Read once without running anything, held to the declared types, a field the report does not declare refused, so nothing it was not written to read rides into a render, a cache or a log ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Where the data came from | Read as the data is, and held to the syntax of identifiers, since the manifest that carries it is kept beside the PDF longer than any log: a form's id and a version's hash by report-spec's provenance rules, a submission's id by one that refuses a space, an `@`, a `/`, a `:`, a letter beyond ASCII and a 129th character, nothing a provider's source does not name, no more submissions than the detail rows given, a provider the runtime does not know refused; never a Data record's token, which spells its key. Its syntax is checked, not its meaning or its truth: a single word, a personal number or a digest of an answer passes ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)) |
| A formancy form and its submission | Read once through their descriptors, own members only, a getter never run, an own `__proto__` refused in a form and unknown in a submission; the form validated by the pinned `@formancy/spec` and named by the hash computed of it, never one handed over; the submission walked by the version's model, an answer under no data path of it refused, a matrix's answer held whole to the version, and only the answers the report reads inspected; lists bounded by `MAX_DETAIL_ROWS` before an item is read, a string answer by `MAX_STRING_LENGTH` before it is read and a rich text before formancy's parser reads it, nothing nested past `MAX_DOCUMENT_DEPTH`; a host's `labels` that throws refused, its exception kept from the read; each version's scopes and options indexed once, so a read is linear in what it is handed; no answer in a message or a path, a refusal of what an answer holds at the field's own path ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)) |
| An image | An approved asset's id and digest, resolved by the host, never an address; its bytes checked as the PNG or JPEG they say they are, a JPEG's frame header read where PDFKit reads it, or, for an SVG, as exactly the drawing report-spec's `cleanSvg` writes, before pdfmake sees them, and bounded per asset and per render ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), [0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| An SVG | Read once, where it is approved, by report-spec's own tokenizer on bytes, which is iterative, so that no nesting reaches the stack before the depth bound is checked; the passes after it recurse, to `MAX_SVG_DEPTH` levels at most. What never draws is removed and listed, text, embedded pictures, `use`, references out of the file and entities beyond XML's own refused, the rest written in one canonical form that every reader between it and the page reads alike; bounded in bytes, depth, elements, stops, dashes, rules, the cascade's work, what it costs to paint and the page-sized groups it makes, and read in time linear in its bytes. Every refusal says what was found and what to do. The renderer draws that form alone, behind its own list of elements and the converter's callbacks; in an e-invoice it also refuses one whose numbers, at the image's box, could pass the integers a PDF/A-3 holds, or whose nesting its graphics state, by a bound from the extent the cleaner measured ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| A file a person adds | Its size held to `MAX_ASSET_BYTES` before it is read; recognised from its bytes by report-spec's `sniffImage`, never by its name or a type a browser guessed; a PNG's or a JPEG's structure, every chunk's CRC and its sides read by `imageHeader`, the renderer's own reader, a PNG's image data held in one array however many chunks it holds, a CMYK JPEG refused in a Factur-X invoice, and an SVG cleaned whole by `cleanSvg`; kept by the host before the report declares it, the store keyed by digest since the id it is handed is the one the add means, and its id, folded from its name, the one thing of the name the report holds. A PNG's image data and a JPEG's scan are first read when it prints ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)) |
| A host's token | Verified offline by Formancy Data's verifier, under the algorithm the key's kind pins, `iss`, `aud`, `exp` and `sub` required, its tenant claim required; nothing else a request carries -- a body, a query, another header -- contributes to who is asking. Every bad token is the one 401, its reason in the log naming a check or a claim and never the token or a claim's value; no audit event holds either, who asked named by keyed hash ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md), [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)) |
| A request to the server | A path that is not plain -- an escape, one that does not decode, a dot or empty segment -- refused before any route, by formancy.ai-data 0037's rule; a method or a path the API does not hold answered before its body is read, counted, its connection closed; a preflight with a body refused unread; what Node's parser cannot read, and an error of the server's own, each answered with a fixed refusal that quotes nothing of the request; a request that takes over 300 s to arrive cut; the log names a request by its method and route, never the path, the query or the Host header it was sent with ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)) |
| A server setting | Read once, by `main.ts`, from the environment it was started with; every sentence about one names the setting and never repeats its value, since the commonest mistake is a secret pasted where its reference goes; a `FORMANCY_REPORT_` variable the server does not read stops it, and so does a secret reference to one of its own variables, an audit key under 32 bytes or one that is the identity key, and trusted proxies that together trust a whole family (0046) |
| A draft a host saves to the server | Its body no byte past report-spec's `MAX_REPORT_BYTES`, refused by the length it declares before it is read, and none before the token is verified; JSON alone, parsed by Fastify's own parser; then, after `can`, held to report-spec's identifier for the template's id, to a precondition naming a revision by `isRevision`, to `validateReport`, to the report's own `id`, and to every image it declares kept for the tenant as the kind it declares, and no font; stored as the report the validator returned, and `savedBy` the verified token's subject, never anything the body says of who wrote it. A refusal's errors, the revision that stands and the assets not kept go to the requester alone, never to a log or the trail ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)) |
| An image a host keeps on the server | Its bytes no more than `MAX_ASSET_BYTES`, refused by the length declared before they are read; recognised by `sniffImage`, the media type claimed held to what the bytes are, a PNG's or a JPEG's header read by `imageHeader`, an SVG held to `MAX_SVG_BYTES` and to the form `cleanSvg` writes by `checkSvg`, and the bytes' SHA-256 held to the digest in the path, all before the store sees them; read back checked against that digest (0049) |
| A file in the server's store | Read only under the names the store writes; a draft's record held to its `format`, to JSON and to the SHA-256 of its report's text, and never validated again, so a later report-spec meets it where it is opened; a template id, a digest and a tenant claim checked again before any file operation, a tenant named by the SHA-256 of its claim; a record that fails a check never served, and logged by its path inside the tenant's directory and the tenant's keyed reference, never its absolute path, whose tenant directory is the claim's unkeyed hash (0049) |
| A font file | Read from its own name table by the licence guard, and refused when it cannot be read; a font inside a script the guard does not see ([§8.7](#87-licences), [0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)) |
| A font's bytes | Read once, by report-spec's reader, which the renderer reads its own faces' character maps through today, and a builder and a host's approval will read a host's font through (`readFont`): every table's offset and length held to the bytes, its recorded length read as fontkit reads it, every read checked against them, every count against the bytes it counts before anything is read by it, every loop bounded by them and nothing recursing; the character map read as fontkit, which PDFKit prints with, reads it, its segments sorted and apart; the PostScript name, which PDFKit writes into the PDF unescaped, held to characters that write no PDF syntax and to encodings fontkit decodes alike; the name strings fontkit decodes, a glyph's points times its contours and the characters mapped bounded; the line the horizontal header makes, by which pdfmake lays every line out and the renderer counts the page limit, held above nothing and within a measured range; and an fsType that forbids embedding a subset of the outlines refused, with no override. The licence the font states is handed back for a person to read and judged by nothing. The layout tables fontkit runs at print, GSUB, GPOS, kern and morx, are not read, and a crafted one can make a render throw or never end ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)); the renderer strips those records from a host face before it embeds it, so fontkit builds no engine to run them, and prints Latin, Greek and Cyrillic alone, refusing every other script, which would need them; it refuses a host face PDFKit would draw as another, of another face's PostScript name with other bytes or of a name PDFKit's font table holds already, by every name the reader hands back; and the reader bounds a font's outlines together, since a subset holds every glyph a printed character reaches ([0043](../decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)) |
| An ICC profile | PDFKit's own file, which an e-invoice's render reads and embeds as its output intent: admitted by the licence guard by the SHA-256 of its bytes, which a review read, and refused under any other; a profile inside a script the guard does not see, and the renderer's browser test holds pdfmake's copy to the reviewed digest ([§8.7](#87-licences), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |

**Nothing in a package reaches the network but the provider and the
client.** The provider only through the Data client the host made, to the
server and with the token the host chose
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md));
report-client only through the `fetch` the host gives it, to the report
server at the base URL the host names, with the token the host answers,
following no redirect (0049).
The report server answers requests and sends none: its verifier fetches no
key set and no key a token names ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
The form bridge fetches nothing: the host hands each form version and
submission over ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)),
and each version a report is generated from, which it reads the same way
and walks by its model, its notes and its refusals quoting none of the form's words -- no title, label, option, value or locale -- and a pointer formancy's validator writes cut before a catalogue's locale or a message's id ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)), and each version a review compares a new one with, read the same way, an item naming the report's field by its id and what the version did by the diff's kind, never the diff's own words, which quote labels and values ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)).
pdfmake reads no file but the fonts it is given and, for an e-invoice,
the ICC profile PDFKit reads from its own package, and no address at all,
which the renderer's tests pin through `fs.readFileSync`
([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
That is pdfmake's own reading: the SVG converter it vendors would open an
`<image>`'s file past pdfmake's access policy, or a virtual file in a
browser, which `pdfmake.test.ts` pins; an SVG's `<image>` is refused by the
cleaner, by the renderer's list of elements and by the converter's image
callback, each on its own
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
The corpus hands ZXing its WebAssembly from the package's own file, where
the library would fetch it from a CDN
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md));
the Studio and the pages ask no other site for anything, which the browser
gate and the pages' checks fail on
([0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)).

**Digests are trusted.** The runtime does not check an image's bytes
against the digest that names them, and trusts the host's lookup to return
what the digest pins
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
0010 gave as its reason that the runtime has no hash function without Node
or the DOM. A pure SHA-256 has been in its dependency closure since 0.1.0:
`@noble/hashes`', which `@formancy/spec`'s `schemaHash` uses and
report-spec's `reportHash` calls, and report-spec's `assetDigest` takes an
added image's digest with it ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)). Checking digests changes what every host's resolver must satisfy,
and is a decision of its own, still not taken. The report server keeps an
image only under the SHA-256 of its bytes and checks it again as it reads
one (0049); the runtime checks nothing of what a host's lookup returns,
and the getting-started guide's cache takes the server's answer as it
comes. Until then, what prints of an SVG is in the
approved form, and that it is the approved drawing is the host's
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

## 8.5 Determinism

A report rendered twice from the same data and parameters prints the same
thing. An expression may not call `now()`, `today()` or `random()`, and the
runtime evaluates with fixed capabilities besides
([0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)).
The PDF's creation date is the host's, passed in, so one document renders to
the same bytes ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).
That holds of its images too only because the renderer orders them. PDFKit
numbers the soft mask of a PNG with an alpha channel or a palette's
transparency, and writes such an image and an interlaced one, when its
decode calls back, in whatever order the decodes finish, and two renders
of one document differed so; the renderer has those images written in the
order pdfmake opened them, which `report-render-pdf/src/image-order.test.ts`
holds in both entries on the PDF it produced, and the install gate on the
PDFKit a clean install resolves
([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).
Rows with equal keys keep the provider's order
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
The hash is taken over a canonical form, so key order never changes it
([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
An SVG asset's bytes are a function of the file alone, written from
`cleanSvg`'s own tree, and cleaning them again gives them back, which
report-spec's `svg.test.ts` holds over every sample and a thousand
mutations
([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
An e-invoice's XML is written one way and reads no clock, so the same
report and data are the same bytes, which
`report-runtime/src/lower-e-invoice.test.ts` holds, and
`report-runtime/src/cii.test.ts` pins those bytes
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
Its PDF/A-3b dates the embedded file with the document's creation date, so
one e-invoice draws to the same bytes each time within an entry, which
`report-render-pdf/src/corpus.test.ts` and `browser.test.ts` hold. The two
entries do not draw the same bytes: pdfmake's browser build deflates with
a zlib of its own, and its PDF of the first sample was 37,307 bytes where
Node's was 37,578 on 18 October 2026. They draw the same objects, every
stream inflated, which `browser.test.ts` holds with report-corpus's
`inflatedDigest`; and the e-invoice gate records each PDF by that digest,
so that another zlib, which may deflate them otherwise, does not fail it
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).

What it does not cover: the characters Intl prints are the engine's ICU's,
so the same report can print differently under another Node
([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
[0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md));
and best-effort data from Formancy Data is read at several moments
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

## 8.6 Four version lines

A report meets three version lines, none of them a package version:
formancy's form spec, Report's own `reportSpecVersion`, and Formancy Data's
contract. [0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)
decided that each document says its version inside itself and that a reader
refuses one it does not know, naming it and the ones it reads; the server
added a fourth, its API and its records ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)). Three
lines are read that way today:

| Line | How it is read |
|---|---|
| `reportSpecVersion` | Read by report-spec's `version.ts` before anything else in a report; another version is refused, naming it and the one the package reads (`report-spec/src/version.test.ts`). It is `'0'`, a draft: nothing written under it is promised to a later release |
| formancy's form spec | Read by report-forms, the one package that reads a form ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)): a `specVersion` the pinned `@formancy/spec` does not read is refused before the form is validated, naming it and the ones that release reads, 1 to 4; every other form goes through upstream's `validateSchema`, which the bridge adds no reading to (`report-forms/src/read.test.ts`, forms at every spec, one Formancy Data generated at spec 3 among them). A form handed to report-spec is still refused as not a report, its `specVersion` named |
| The server's API and records | Its API by its path: every route a token reaches is under `/v1` (report-server-core's `API_PREFIX` and `ROUTES`, `wire.test.ts`), a route nothing names is the one 404, and a shape a client could not read as before is a route under `/v2` beside it. Its records each carry a `format` from the record that introduces them, refused when unknown (0046). The first is a draft's, `DRAFT_FORMAT`, 1: the file store refuses a record of another number, naming it, and one that is no record, and serves neither (`report-server/src/file-store.test.ts`, [0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)). An image is kept as its bytes, under the kind they sniff as, and carries no format of its own |
| Formancy Data's contract | The provider reads no version Data states, which is less than 0004 decided. It is built against 0.1.0 exactly, and a Data whose routes or replies change is refused by the client's checks of their shape, as `unexpected`, or by its server ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |

The tuple a release was tested with is the release report's, derived from
its run
([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)).

## 8.7 Licences

The product is source-available ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)).
Every published package declares `SEE LICENSE IN LICENSE.md` and carries
`LICENSE.md` and `NOTICE`, which `scripts/sync-licenses.mjs` copies in at
build time and `scripts/verify-licenses.mjs` checks. Every production
dependency and every font file a published package ships is held to an
allow-list of permissive licences by `scripts/dependency-licences.mjs`,
reading a font's licence from the font; an exception records a person's
reading of a package's own licence file, at one exact version, and an ICC
profile, which states no terms, is admitted by the digest of its bytes
and the licence sentence a review read ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md))
([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).

0006 lists what the guard cannot see. Each, and what holds it instead, if
anything:

- **A licence's terms.** The guard trusts the identifier, so a package that
  declares MIT and ships GPL code passes. Nothing holds this: 0006 says the
  inventory review owed before the first paid release is still owed.
- **A font or a profile inside a script.** pdfmake's vfs_fonts.js carries
  Roboto as base64, and the renderer's browser build carries Liberation
  Sans so, for the slip and for an EPC QR code's caption; pdfmake's browser
  build carries the sRGB profile an e-invoice's PDF/A embeds as base64
  too. The renderer's `browser.test.ts` holds the fonts to the bytes of
  the font files the guard does read, and the profile to the digest the
  guard reviewed in PDFKit's file
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md),
  0031).
- **Code a package vendors** under a licence of its own. pdfmake's
  svg-to-pdfkit draws every QR code, an EPC QR code's frame and caption,
  and every SVG asset (0030);
  review read its MIT licence on 17 October 2026, and the guard judges it
  by pdfmake's field alone
  ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
- **What the e-invoice gate runs, and what was copied from it.** Its
  downloads carry works under their own licences -- Saxon in both, veraPDF
  under the GPL or the MPL in Mustang's, CEN/TC 434's EUPL-1.2 schematron
  in Mustang's and in KoSIT's configuration -- which nobody here reviewed
  one by one. They run in CI and no package carries them, so 0006, which
  governs what a package ships, does not reach them. veraPDF's own pin,
  under GPL-3.0-or-later OR MPL-2.0, is admitted for the gate at its
  pinned release alone (0031). But report-spec's
  closed lists hold codes copied out of CEN's EUPL-1.2 lists, and the gate's
  recorded reports quote CEN's rule texts; whether either is acceptable
  under 0006 is the rightsholder's open question. The ZUGFeRD and Factur-X
  marks are AWV e.V.'s, and their conditions have not been read
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).

**A font a host supplies is the host's, under its licence.** The guard
reads the fonts a published package ships; a host's font ships in no
package, so 0006 does not reach it, and nothing here reads its licence:
report-spec's reader refuses a font whose fsType forbids embedding a
subset, and hands back the licence description it states, for a person to
read ([0040](../decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)).

**Formancy Data's packages are admitted, each for its own package.**
Data's client and core at exactly 0.1.0 for the provider
([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)),
and Data's identity verifier at exactly 0.3.0 for the server
([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)), each by the digest of the licence file a
review read; Data reached from any other package is refused. Running either
package in production needs a production licence for Data as well.

A built app carries the licence and notice texts of everything it bundles
(`scripts/third-party-notices.mjs`, after
[formancy.ai-data 0046](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0046-a-built-app-carries-the-licence-and-notice-texts-of-everything-it-bundles.md)).
The SBOM describes what a consumer installs, not the workspace
([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)).

## 8.8 Languages

Several sets of words, and they are kept apart:

- **The report's own words** are the author's, in the report's locale. Its
  values are formatted for that locale by Intl
  ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **The builders' words** are report-builder-core's one catalogue, in
  English, Swiss German and Swiss French; both builders read it, and the
  scenarios run in all three. A session's undo labels are English sentences
  each editor puts back into its own language
  ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).
  The validator's and the diagnostics' sentences are English: they are
  keyed by stable codes, and their translation is a later step. Why an
  added image was refused is the builders' own sentence for each code,
  report-spec's and 0030's, in the three languages, and the host's
  refusal is shown in the host's words ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
- **A QR-bill's headings** are in the slip's own language, one of SIX's
  five, which may differ from the report's
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
- **An EPC QR code's caption** is Austria's words, "Zahlen mit Code", as the
  PSA prints them, whatever the report's language. The builders call the
  code "EPC payment code", "EPC-Zahlcode" or "Code de paiement EPC"; the
  name some banks give it is not used, because nothing here found who owns
  it or what rules come with it
  ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **The product's pages** are German, French, Italian and English, every
  page in each ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)),
  and so is the invoice, as the corpus's samples
  ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).
  The euro invoice's samples are in German for Austria, French, Italian,
  Spanish, Dutch and English for Ireland, each in its locale; Spanish and
  Dutch are seen only as pictures, since no page is in either. The German
  pages are Switzerland's spelling, and are read by Germans and Austrians
  ([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
  No native speaker's review of the translations is recorded.

Body text prints in Roboto alone, so a script Roboto lacks — CJK, Hebrew,
Arabic, Thai — is refused rather than printed in boxes
([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
Liberation Sans prints a QR-bill's slip and an EPC QR code's caption. The
caption is drawn in that face or the render fails: where pdfmake's SVG
converter cannot open a face it would warn and draw the text in the last
face it used, and the renderer refuses the warning instead (0022, 0025).

## 8.9 Accessibility

Of the builders, by construction: every drag has a keyboard path, which
report-core's commands are shaped for
([formancy.ai 0046](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0046-keyboard-before-drag.md));
keys are decided once by `actionForKey`, and a key pressed in a host's view
the builder draws in its middle is the host's and never reaches it
([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)); and the tests find elements by role
and accessible name, the rule upstream's
[0034](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0034-accessible-name-only.md)
set for its drivers, so markup a screen reader cannot navigate is markup the
scenarios cannot drive. Where the accessibility tree cannot answer — which
framework drew the builder, a stylesheet's reach, a canvas's pixels — a test
reads the DOM, and its header says why
([`CLAUDE.md`](../../CLAUDE.md)). axe runs at the end of every scenario in each builder, and
the Studio's browser gate measures colour contrast and target size in
Chromium ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
Automated checking is a floor, not a conformance claim.

Of the PDF, nothing yet: no record decides how a generated PDF is read by
assistive technology, and no test reads one so. An e-invoice's PDF/A is
level b, which asks for no structure tree, since pdfmake builds none
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)). A QR code's text is not the
PDF's text at all — search, copy and a screen reader find nothing in it —
so a template that wants it read prints it beside the code
([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
The EPC means its code to be printed so, beside the details it holds, and
the euro invoice does, which its test reads; nothing checks that any other
template does. An EPC QR code's caption is text, which a reader finds
([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## 8.10 The room

The builders and the Studio are formancy.ai's interface concept applied, as
Formancy Data's apps are, not a new one. `report-builder.css` is the
builders' only stylesheet; it selects by the hooks both builders render and
colours only through the workbench's `--wb-*` variables. It is one entry,
its export's name, that imports its rules from `styles/` beside it, a file
per reason to change, which the package publishes, and every guard reads it
with those imports resolved ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)). The palette is
formancy's own, released as `@formancy/themes/room.css`: the Studio's
`main.tsx` imports it after the workbench, whose `--wb-*` it sets, and the
product's pages import it first and then the Studio's stylesheets, never a
copy of either. `scripts/palette.test.mjs` refuses a stylesheet here that
sets one of its variables or types one of its colours, both read from the
installed file -- a tint is `color-mix()` of the variable -- and an app
that takes it before the workbench; the browser gate reads its variables
on the built page
([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md),
[0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md),
[0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
[0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)).
The Studio's own are the text's two font stacks, the page's rules and
`builder.css`, admin.css's geometry for the workbench: admin.css's rules,
still copied, with the colours they type that the room does not carry,
since the room carries no rule.
The Studio's bar is one shell for the playground
([formancy.ai 0106](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0106-one-shell-for-every-page-of-the-site.md)).

**The page is the document, not the room.** What prints is the report's own
serialisable styles; no rule of the editor's or the host's reaches a
customer's PDF. The design view is not the PDF and says so by its name; the
Studio's Preview is the PDF, drawn by PDF.js on white paper that no rule of
the room's reaches.

**A host's view in the builder is the host's.** Where the Studio's Preview
stands in the builder's middle, in the design view's place, it is inside
the workbench but in no pane of it: the region the builder draws carries no
workbench class, so no rule of `@formancy/themes/workbench.css` or
`report-builder.css` dresses its controls, and the Studio's own rules do.
One rule of the
builder's reaches it and its paper all the same: the workbench's `.wb *`,
which turns transitions off when motion is reduced and draws nothing. The
Studio's stylesheet test and the browser gate admit that selector while it
declares transitions alone, and refuse any other
([0029](../decisions/0029-the-preview-stands-in-the-design-views-place-where-it-does-not-fit-beside-the-builder.md)).

## 8.11 Whom a payment reaches

A report's payment codes -- the QR-bill at its own level, an EPC QR code in
a region -- and an e-invoice's BT-84 name an account, the one term a person
can edit that changes whom money reaches. Every edit of one is a command, so
a review of a proposal can find it by name: report-core's registry lists the
commands that may change the bill and the e-invoice (`PART_COMMANDS`),
`replaceDocument` among them, whose parts a review compares whole, and
`batch`, whose steps a review will read by the same names once proposals
are reviewed ([0048](../decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)),
and an EPC code's account is an `updateComponent` of its `iban`. In a
report with an e-invoice the one account is changed everywhere at once,
by `setPaymentAccount`, wherever a person types it where every place
writes it in the report -- where one reads it from the data, each field
writes its own -- and a review finds that command by its name ([0044](../decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)). The checks are report-spec's, the
same for a literal the editor refuses and data the runtime refuses: an IBAN's
country, length and check digits, the QR-IBAN's pairing with its reference,
and, with an e-invoice, one account for the page and its XML
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md),
[0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
What none of it can tell is whether an account is the creditor's: the
editor confirms no changed account, warns of SIX's examples alone -- its
example accounts, and the creditor, the debtor and the QR reference a builder
puts in -- and leaves who may change whom a bill pays to the host ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).

## 8.12 Who is asking, and what they may do

The server's one answer to both questions
([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)):

- **Who.** The host's token, verified offline with Formancy Data's
  verifier under Data's rules ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)): a subject, a
  tenant from the claim `FORMANCY_REPORT_ATTRIBUTES` maps, required, and
  roles from the roles claim. That is report-server-core's `ReportIdentity`,
  and nothing else a request carries contributes to it. There is no
  session, no password and no key of the server's own.
- **What.** Three capacities, author, publisher and administrator, given to
  the host's roles by the operator's settings, and one table of actions,
  each with the capacities that may take it. A route that takes an action
  asks `can` with it -- the draft slice's five do, each through its use
  case and before it reads the request or asks the store, and whoami takes
  none (0049) -- an action the table does not hold is nobody's, and no
  capacity implies another. whoami answers `actionsOf`, which agrees with
  `can` action by action, so the host's wiring shows before anything
  depends on it. A malformed precondition, a body past its route's limit
  and a media type the route does not read are answered before the use
  case, so before `can`.
- **From which page.** A page on an origin the operator lists may send the
  headers the routes read and nothing more, `CROSS_ORIGIN_REQUEST_HEADERS`
  -- the token, the body's media type, `If-Match` and `If-None-Match` --
  and read the `ETag` a save names a draft's version by,
  `CROSS_ORIGIN_RESPONSE_HEADERS`; a token-bearing request a browser marks
  cross-site from any other origin is refused before its token or its body
  is read (0046, widened by 0049, `wire.test.ts`, `cors.test.ts`).
- **Which tenant.** Every request has exactly one, the token's, and no
  request can name another: there is no tenant in a path, a query or a
  body, and no single-tenant mode without the claim. The store is asked
  with that tenant first and never reads across tenants; a draft and an
  image are the tenant's, and a template's id names a template within it
  (0049).
- **What is said of it.** One audit event per answered request: the route,
  the status, the outcome's code, whether it was identified, and the tenant
  and the person by HMAC-SHA-256 under the operator's audit key, over a
  JSON array so that no two people share a reference, or `null` without
  one; the key at least 32 bytes and not the identity key. Never a token, a claim's value, a path or a body -- so
  never a template's id, a title, a digest or `savedBy`, which the store
  keeps and the trail does not; the log names a template's id or a digest
  only in the line about a stored file the store did not write and in the
  line about the file system failing the store, each by the file's path
  inside the tenant's directory (0049) -- and never evidence: Data's
  limits, formancy.ai-data 0023.
