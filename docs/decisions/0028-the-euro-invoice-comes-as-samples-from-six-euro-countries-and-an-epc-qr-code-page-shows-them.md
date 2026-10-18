# 0028 — The euro invoice comes as samples from six countries of the euro, each selling parts at its country's standard VAT rate, and an EPC QR code page in each language shows them

- **Status:** accepted; extended by
  [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
  whose runtime writes an e-invoice's XML, and by
  [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
  whose renderer draws the PDF/A-3b that embeds it, as this record's page
  now says; and by
  [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md),
  under which every sample prints the firm's mark at the head of its
  page, so that the starter's digest pinned here, `27583910…`, is the one
  before the mark
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The samples, in the corpus.** report-corpus's
    `src/starters/euro-samples.test.ts`, with every locale, rate, account,
    BIC, reference, label and address stated in the test and never read
    from the sample:
    - the samples are the euro invoice from Germany, Austria, France,
      Italy, Spain, the Netherlands and Ireland, the German the starter
      itself, the Austrian alone in Austria's frame, and none of the six a
      starter of the Studio's;
    - each report has an id of its own, and the starter is byte for byte
      what it was: the SHA-256 of `JSON.stringify(EURO_INVOICE)`,
      `27583910c32cff6e3965fd0059cafa7876aa22972aa4e1ff7b447cd051bcb937`
      before the samples, is pinned;
    - each validates with no diagnostic and resolves its own data in a
      final render;
    - each is paid by one code whose payload is compared whole, element
      by element, with its total computed in BigInt at the rate the test
      states, to its own firm's account by its own reference;
    - each rate is the one the test states, in the tax line's expression,
      the total's aggregate and the tax line's label;
    - each account is of its country, by the bank code its countries file
      names, behind a test BIC of that country, and report-spec's
      `checkEpcIban` and `epcPairing` apply to it: the IBAN with two digits
      swapped is refused on the IBAN, and another country's BIC on the BIC;
    - no German is left in the French, Italian, Spanish, Dutch or English
      but what the language writes alike; the six sell the same parts at
      the same quantities and prices; each customer's address is printed
      in its country's order; each code's square holds every payload the
      EPC allows, with the frame and without; and each sample's total is
      under a thousand euro;
    - each sample's line at its head is stated whole, the French one with
      the legal form, share capital and SIREN France's administration asks
      of a company's invoice, and each one's notice under its terms, the
      Italian's that it is a courtesy copy and where the original is;
    - every space before a mark French spaces, and before Spanish's percent
      sign, is a no-break space, and the samples have some;
    - the French, Italian, Spanish and Dutch accounts' national check
      digits are computed again by each country's rule, each rule first
      run on the example SWIFT's IBAN Registry gives for its country, the
      French one's letter M read as the 4 the RIB key makes of it;
    - and a country whose lines and words disagree in number is refused as
      the module loads, rather than a line dropped.

    Watched failing, one change at a time, with: the Austrian caption
    dropped, and one added to the French; a sample added to `STARTERS`;
    two samples given one id; two of the starter's styles reordered, and
    its tax line's label changed; the French IBAN in the Italian sample;
    one quantity drifted; the Dutch rate 20; the Spanish tax label written
    out rather than made from the rate; Austria's bank code 12000, a
    bank's, with its check digits made right; the Irish BIC without the
    test BIC's 0; "Bankverbindung" left in the French; the French address
    street first; a 30 mm square; and a price taking a total past a
    thousand. After review, with: the French colons' no-break spaces made
    plain, the space before the share capital's euro sign made plain, and
    the Spanish percent sign's; the French RIB key 81 with ISO 13616's
    digits made right for it; a sixth Irish line before the refusal was
    written; and the French mentions, the Italian notice's words and the
    Spanish and Italian addresses' commas each stated before the samples
    had them.
  - **Their PDFs** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/euro-samples.test.ts` renders each sample and
    reads it back with PDF.js: one page; every line, the net amount, the
    tax and the total exactly as `Intl` formats, for a locale the test
    states, the values it computes in BigInt, under labels it states; the
    due date and the customer's lines; the code decoded by ZXing from the
    page's pixels at level M, in version 13 at most, asking for the total
    the page prints; the beneficiary, the IBAN, the BIC, the amount and
    the reference beside the code, in the sample's words; the code in the
    page's left half below the totals; "Zahlen mit Code" read back as a
    turned run on the Austrian sample and on no other; and no glyph
    missing and no amount with a grouping mark on any page. Watched
    failing with the
    Italian sample in `de-DE`, the Spanish "Importe" printed "Betrag",
    the caption on the Irish sample, the Austrian caption dropped, the
    shipping taking a total past a thousand, and a tax line at another
    rate than its label; after review, with the Spanish and Italian
    addresses' commas stated against the corpus's build without them.
  - **Their pictures.** report-render-pdf's `src/pictures.test.ts` holds
    every sample of both invoices to a picture in `docs/images/samples.json`,
    that manifest to samples alone and `pictures.json` to starters alone,
    and each picture to the page it was drawn from. Watched failing with
    the six pictures not yet taken, the Irish picture drawn from the
    French sample, a euro sample listed in `pictures.json`, and the
    Austrian caption quoting "Umsatzsteuer 19 %".
  - **The pages' suite, `apps/pages`.**
    - `src/epc-qr-code.test.ts`: the page refuses to render once the
      changelog names a later release, naming its three sentences; it says
      it is in no release in its hero and in the product page's teaser,
      four words at least, and its try-it text names the release the guide
      installs; it shows the starter and the six samples, its own
      language's first and the rest in a fixed order, and is shared with
      its own language's picture; its hero opens the Studio's root, naming
      the starter to choose, and its try-it text names the palette's word
      for the code; it and
      the QR-bill page link each other from their limits, once each; every
      card's tests (`CARD_EVIDENCE`) are files of the checkout, one list
      for each card in every language; its samples' rates and
      registers are dated, and the samples link this record, which cites
      each with its address; and it shows every euro invoice sample
      `docs/images/samples.json` records, and no other.
    - `src/site.test.ts`: the page at `epc-qr-code`, `qr-code-sepa`,
      `qr-code-sepa` and `epc-qr-code`, between the QR-bill page and the
      healthcare page, every check of
      [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)
      passing for it, and one error naming both pages when the changelog
      names a later release, each page's line matched whole, to the
      constant it names.
    - `src/qr-bill.test.ts`, unchanged and passing: the QR-bill page's
      refusal, in its own words, now made by the site.
    - `src/checks.test.ts`: the name some German banks give the code, which
      [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)
      keeps off everything here, refused in a sentence, in a slug, in
      lower case with a hyphen, in a picture's description, with a letter
      written as an entity, with a non-breaking hyphen, a soft hyphen, a
      zero-width space, and an en dash between spaces. The test puts the
      name together from its two words, so that neither its file nor the
      test names the release report collects spell it.
    - `src/figures.test.ts`: every euro figure's quotes on a line its
      picture's page prints and in its description in every language.

    Watched failing, one change at a time, with: the group without its
    status; `renderSite` throwing at the first stale page; the status
    sentence dropped from the hero, and from the teaser; the English page
    leading with the German starter; the samples after the first in
    reverse order; every language shared with the starter's picture; the
    hero's action to the product page, and without the starter's name; the
    QR-bill page's link removed; a card's tests removed, or one renamed;
    the registers' sentence undated; the Austrian figure quoting
    "Umsatzsteuer 19 %"; a French description dropping a quote; the Irish
    figure showing the French file; an amount written into the samples'
    text; the bank's name for the code in the German lead; and the euro
    figures left out of `FIGURES`, which fails as the suite loads. After
    review, with: the QR-bill page's status naming another constant and
    one sentence fewer, which every case passed before its line was
    matched whole; a sample added to `samples.json`; the samples without
    the link to this record; and the name joined by a non-breaking hyphen,
    a soft hyphen, a zero-width space and an en dash, which the check
    passed until its pattern took every dash, space and invisible format
    character.
  - **By hand, on 17 October 2026, after review.** The built pages, all
    sixteen of the sitemap, served under `/report/` by a script outside the
    repository on a port of its own, in Chromium 156.0.8078.4 of
    Playwright 1.64.1, measured by the Studio's browser gate's own
    `measureWidth` and `audit` (`apps/studio/scripts/gate-page.mjs`), as
    0024 measured its pages: at 320, 360, 641, 1280 and 1920 pixels none
    scrolled sideways or had anything past either edge, axe 4.14.0 found
    no violation, colour contrast and target size were measured and no
    text's contrast was left undecided, and no page asked for anything
    outside the site. Every page's bar names the three topic pages, so
    0024's measurement, made with two, described none of them any more.
  - **The architecture.** `scripts/architecture.test.mjs` fails while no
    section links this record.
  - **The register.** `scripts/release-report/limitations.test.mjs` in
    `pnpm test:repo` fails while this record has no entry in
    `docs/release/limitations.json`, and while 0024's and 0025's Status
    lines, and 0021's, are not read again and stamped.
  - **Each rule reverted once more, on 17 October 2026,** with the
    documents written: 33 reverts over the samples, their PDFs through the
    corpus's build, their pictures and the README's, the pages, the
    site's status check and the wording check, and the register, each
    failing the test meant for it on an assertion, and each file put back
    byte for byte, its sha256 checked, with the corpus's build after it.

  What holds nothing: the translations, which no native speaker has
  reviewed; each country's tax and invoicing law, and whether the standard
  rate applies to a sale of parts; the rates after the day they were read;
  that no bank keeps the Italian and Irish bank codes; that the invented
  firms and addresses are nobody's; the Studio's words the page names, "Euro
  invoice", "Starter" and "EPC payment code"; the search terms the slugs and
  titles bet on; and the measurements in a browser, which no gate repeats.

## Context

The rightsholder asked for promotion of the invoices on the site, and for
samples in European languages
([0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).
The QR-bill's invoice has its samples and its page. The EPC QR code is
built (0025): the Studio's euro invoice starter, a German heating firm's
invoice to a private household for maintaining its gas boiler, at 19 %,
prints one. No page shows the code, and the one euro invoice shows
Germany's words, rate and account alone. 0021 leaves a payment code's page
to the change after the code.

The forces:
- **The starter's work does not take the standard rate everywhere.**
  Read on 17 October 2026:
  - France: 10 % for "travaux d'amélioration, de transformation,
    d'aménagement ou d'entretien" in a dwelling finished more than two
    years ago, the customer certifying the conditions (service-public.fr,
    F23568, "Vérifié le 21 février 2026",
    https://entreprendre.service-public.gouv.fr/vosdroits/F23568).
  - Ireland: "Generally, the reduced rate of Value-Added Tax (VAT) applies
    to construction services", plumbing among them, 13.5 % (Revenue,
    https://www.revenue.ie/en/vat/vat-on-property-and-construction/construction-fixtures-fittings-solar-panels/construction-services.aspx).
  - Italy: 10 % for the ordinary maintenance of a dwelling, and Spain: 10 %
    for repairing a private dwelling whose materials are at most 40 % of
    the base, by secondary sources only; the Agenzia delle Entrate's guide
    and the BOE's text of the VAT law were not read. The starter's parts
    are 514.63 of its net 951.63, about 54 %, so by those sources Spain
    taxes its work at the standard rate, as it does the samples' parts.
  - The Netherlands: 21 %; the 9 % list for work on homes is insulating,
    painting, plastering, wallpapering and cleaning (Belastingdienst,
    https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/diensten_9_btw/werkzaamheden_aan_woningen/werkzaamheden_aan_woningen).
    Austria: 20 %; the USP's examples of its reduced rates name no repair
    or maintenance, and the full list, § 10 UStG, was not read (USP,
    "Letzte Aktualisierung: 1. Juli 2026",
    https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/steuersaetze-und-steuerbefreiungen-der-umsatzsteuer.html).

  The VAT Directive's Annex III, point (10a), lets a member state reduce
  the rate for "renovation and repairing of private dwellings, excluding
  materials which account for a significant part of the value of the
  service supplied"; EUR-Lex did not load, and the wording is from
  secondary sources. A French sample that printed 20 % on that work would
  show a French reader a rate the French administration says is wrong.
- **The Studio's picker is the starters,** and its browser gate holds
  every picture `pictures.json` lists to one (0024).
- **A page's status goes stale** (0024). The QR-bill page's refused to
  render on its own, from its body: with two such pages, a release commit
  would learn of the second only after fixing the first.
- **An account printed on a sample must pay nobody.** Some countries
  publish the bank codes in use, and some could not be read.
- **The pages quote what a picture prints,** and refuse an amount of money
  anywhere else (0021, 0024).
- **One name for the code.** 0025 keeps the name some German banks give
  it, and its logo, off everything here, since who owns it, and what rules
  come with it, nothing here found. Nothing held that on the pages.

## Decision

**One report, made for each country, in the corpus.**
`EURO_INVOICE_SAMPLES` holds the starter itself, unchanged, then the
invoice in de-AT, fr-FR, it-IT, es-ES, nl-NL and en-IE. One function makes
each from two records, split by the reason each changes, and refuses a
country whose lines and words disagree in number:
`euro-invoice-words.ts`, the words each prints, and
`euro-invoice-countries.ts`, whom it bills, at what rate and to which
account, with every source cited and dated.
- **They sell parts.** The six sell the starter's boiler's parts to a
  private customer, and install nothing: the circulation pump, the
  expansion vessel, the ignition electrode, the heating-water inhibitor
  and the shipping, at the same quantities and prices in every sample. A
  sale of parts without installation falls under no point of Annex III
  this record found, and France's reduced rates, and Italy's as secondary
  sources give them, reach goods only where a firm supplies and installs
  them in a dwelling, so the standard rate is each sample's: this record's
  reading, not a tax adviser's. Spain's reduced rate would not have
  reached the starter's work either; France, Ireland and Italy are why the
  samples sell parts.
- **At each country's standard rate,** as the EU's Your Europe table gave
  it on 17 October 2026, "Last checked: 13/07/2026"
  (https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm):
  Austria and France 20 %, Italy 22 %, Spain and the Netherlands 21 %,
  Ireland 23 %. A rate is written as text, its digits made into the tax's
  share and the total's factor, `'20'` into `0.20` and `1.20`, and never
  through a number, so the label, the tax line and the total read one rate.
- **From invented firms, paying accounts with right check digits,** each
  made the starter's way: a bank code, an account of `…12345678`, every
  national check digit first and then ISO 13616's, in BigInt. Where the
  country's register could be read on 17 October 2026, no bank in it keeps
  the bank code:
  - Germany's 01234567, the starter's: the Bundesbank's
    Bankleitzahlendatei "gültig vom 07.09.2026 bis 06.12.2026", 13,760
    records, has every bank code starting with a digit from 1 to 8, and
    no BIC starting FMNC
    (https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592);
  - Austria's 80123: the OeNB's SEPA directory, "SEPA-Verzeichnis-Abfrage
    vom 16.10.2026", has no bank code starting with 8
    (https://www.oenb.at/docroot/downloads_observ/sepa-zv-vz_gesamt.csv);
  - France's 01234: the ACPR's REGAFI register of 16 October 2026 has no
    code interbancaire from 00011 to 09812
    (https://www.regafi.fr/api/explore/v2.1/catalog/datasets/prd-banque-entites/exports/json);
  - Spain's 0000: the Banco de España's Registro de entidades, "FECHA:
    15/10/2026", struck-off entities included, has no entity of that code
    (https://www.bde.es/f/webbe/SGE/regis/ficheros/es/Registro_Entidades.xlsx);
  - the Netherlands' FMNC: the Betaalvereniging's BIC list, "Laatste update
    02-09-2026", has no such bank identifier
    (https://www.betaalvereniging.nl/wp-content/uploads/2025/11/BIC-lijst-NL.xlsx).

  The Banca d'Italia's register answered "Risorsa Protetta", and no public
  list of Irish sort codes was found: Italy's account is made with ABI
  00000 and Ireland's with FMNC and sort code 000000, and nothing more is
  claimed of either than their check digits. Each BIC is a test BIC, a 0
  in its location, of its IBAN's country. Every national check digit, and
  the Dutch account's old eleven test, is computed again by the samples'
  test.
- **Austria's in Austria's frame.** The Austrian sample alone has
  `caption: 'zahlenMitCode'`.
- **Each in its country's ways.** The address in the order its country
  writes it, the number first in France and Ireland, a comma before it in
  Spain and Italy, and no postcode in Ireland, whose Eircode would name one
  real address. The French sample prints its legal form, its share capital
  and its SIREN, which service-public.fr's F31808 ("Vérifié le 11 août
  2026", read on 17 October 2026) asks of a company's invoice, the capital
  500 € so that no grouping mark prints. The Italian prints its partita
  IVA as Italy writes it at home, without the IT, and says it is a courtesy
  copy of the electronic invoice the Sistema di Interscambio carries, whose
  original is in the customer's reserved area of the Agenzia delle
  Entrate's site, as secondary sources read Provvedimento 89757 of 30
  April 2018, whose text was not read.
- **Samples, not starters, in the manifest the samples have.** The Studio
  is what it was. Their pictures are in `docs/images/samples.json`, beside
  the QR-bill invoice's samples, drawn by the same script.

**An EPC QR code page in each language,** a group of 0021's site between
the QR-bill page and the healthcare page:
- its slugs `epc-qr-code` in German and English, the standard's name, and
  `qr-code-sepa` in French and Italian, where a reader meets the transfer
  as SEPA's;
- six cards of what 0025's code does, each beside the tests it rests on
  (`CARD_EVIDENCE`), what it does not do, from 0025's costs and this
  record's, how to try it, and where it stands;
- the seven invoices, the page's own language's first: German the
  starter, French the French, Italian the Italian, English the Irish; and
  its shared picture that one;
- a link each way between it and the QR-bill page: for an invoice to an
  account in Switzerland or Liechtenstein, in francs or euro, and for one
  paid by a SEPA transfer in euro;
- the day the samples' rates and registers were read, `EURO_SAMPLES_READ`,
  on the page, so that neither reads as today's, and a link to this record,
  which cites each with its address.

**Every page's status is the site's to check.** `PageGroup` may carry a
`PageStatus`: the day, the release then, and what to say again. The site
reads every group's before it renders any page, and refuses to render
while one names another release than the changelog's newest, in one error
with a line for each such page. `EPC_QR_CODE_STATUS` is written against
0.1.0, which refuses a report with the code as an unknown kind, as
`QR_BILL_STATUS` is, and its sentences are the same three as the QR-bill
page's: `unreleased`, `tryIt.text` and `status.text`.

**The code is named by what it is.** EPC-QR-Code, SEPA-QR-Code and "QR-Code
für Überweisungen"; QR code SEPA and QR code EPC; the EPC QR code and the
SEPA QR code. The pages' wording check refuses the name 0025 keeps off
everything here, in any case, its two words joined or apart by any run of
spaces, dashes or hyphens of any kind, underscores and invisible format
characters, in a page's source, its text and every attribute, entities
decoded. Nothing written here spells it: the check's test puts it together
from its two words.

## Consequences

**What it buys.**
- **A euro invoice a reader recognises,** in their country's words, rate,
  locale and address, each proved on the PDF it printed and drawn from it
  by a script.
- **A page under the words people search for,** EPC-QR-Code, QR code SEPA
  and EPC QR code, with every claim it makes beside the tests that hold it.
- **One release commit, one error.** Every stale page is named at once.
- **A starter that does not move.** Its JSON is pinned, and the Studio,
  its pictures and its gate are what they were.
- **No rate a tax authority calls wrong** on the samples' lines, as far as
  the pages read show.

**What it costs.**
- **Translations nobody reviewed.** The samples' German for Austria,
  French, Italian, Spanish, Dutch and English, and the page in German,
  French, Italian and English, are this record's, and no native speaker's
  review is recorded. Spanish and Dutch have no page here, and nobody here
  reads them. The German page is Switzerland's spelling, as every German
  page is, and is read by Germans and Austrians.
- **Dated rates.** Each is Your Europe's on 17 October 2026, its table last
  checked on 13 July 2026; a change reaches the samples only by a commit,
  and nothing reads them again.
- **No tax advice.** That a sale of parts takes the standard rate is this
  record's reading of Annex III and of the national pages above, and
  Italy's and Spain's reduced rates were read from secondary sources only.
  Whether a sample carries everything its country's invoicing law asks
  nobody checked whole, and some of it is known to be missing:
  - France: F31808 asks an invoice to a consumer to state the legal
    guarantee of conformity for some kinds of goods, naming household
    appliances, computers and sports goods; the sample does not, and
    whether a boiler's parts are among them was not read.
  - Spain: a full invoice for a sale in Spain names the customer's NIF
    (RD 1619/2012, art. 6.1.d, in the BOE's consolidated text last updated
    31 March 2026, read on 17 October 2026), which the sample does not
    print, so it holds at most as the simplified invoice art. 4.2.a allows
    for a retail sale up to 3,000 euros, and nobody checked it against all
    art. 7 asks of one.
  - Italy, the Netherlands and Austria, by a review's reading that nothing
    here read again: a private customer's codice fiscale and an S.r.l.'s
    REA number and share capital (art. 21 DPR 633/72, art. 2250 c.c.); a
    Dutch firm's KvK number; an Austrian one's Firmenbuch number and court,
    which UGB section 14 asks of business letters. The samples print none.
- **No e-invoice.** No XRechnung, ZUGFeRD, Factur-X or FatturaPA. The
  Italian sample is a courtesy copy because Italy has invoices between its
  residents sent electronically through the Sistema di Interscambio, as
  remembered, not re-read (D.Lgs. 127/2015, art. 1, c. 3, as L. 205/2017
  amended it). Normattiva, read on 17 October 2026, shows that article
  repealed by D.Lgs. 19 gennaio 2026, n. 10, the consolidated VAT code, in
  its text in force from 1 January 2027, which secondary sources say
  carries the rule on; its article was not found, so the citation is the
  law until that day. Spain's Verifactu code is not printed.
- **A limit another change will outdate.** The page says the PDF is no
  e-invoice, and names XRechnung, ZUGFeRD, Factur-X and FatturaPA. A change
  that builds an e-invoice must say so again there and in this record's
  register, and nothing fails when it does not.
- **The starter and its samples bill different lines,** maintenance and
  parts, so the seven pictures side by side are not one invoice seven
  ways, as the QR-bill's four are.
- **The numbers are the engine's ICU.** Under Node 24.21, with ICU 78.3,
  where the pictures were taken, de-AT and nl-NL put the euro sign first,
  "€ 629,44", and en-IE prints "€645.17". CI runs Node 22, which was not
  measured here: there, as under any Node, an ICU that prints them
  otherwise fails the pictures' test, then the page's quotes, until the
  pictures are taken again. Every total is under a thousand, so no
  sample's amount shows a grouping mark: fr-FR groups with a narrow
  no-break space Roboto has no glyph for, which the renderer refuses
  ([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
- **Two accounts rest on their check digits alone.** The Italian and the
  Irish registers could not be read. And an account whose bank code a bank
  is given later is that bank's.
- **Accounts and BICs by others' rules.** The test BIC's 0 is Wikipedia's
  reading of ISO 9362, as 0025's. Each national check digit's rule is
  this record's reading of it, run on SWIFT's example for its country.
- **Invented firms at real-looking addresses.** Nobody checked that no
  business is at them. Each VAT number fails its country's check, computed
  once on 17 October 2026, and no test holds that.
- **The Studio's words, typed.** The page names the starter "Euro invoice"
  under "Starter" and the palette's "EPC payment code", which nothing here
  reads, and its hero opens the Studio at its first starter, which is not
  the euro invoice, saying which to choose.
- **Pictures.** 693,217 bytes for the six, as `ls` measured them on 17
  October 2026, in the repository and on the site, and seven figures on
  one page.
- **The next release touches two pages.** A release commit fails
  `pnpm build` and the pages' suite until both pages' statuses are written
  again, in their three sentences each, as RELEASING.md's second step says.
- **A name no page may say.** A reader who searches for the name some
  German banks give the code finds no page here by it, and the check
  refuses it in a quote or a denial as anywhere else. It does not see the
  two words apart by a letter or a digit, or spelled in another script.
- **Measured by hand, once.** The pages' reflow from 320 pixels and their
  contrast were measured on 17 October 2026, all sixteen with the bar's
  three topic names; no gate measures the pages, so a later change to them,
  or to the Studio's stylesheets they import, is measured by nobody.
- **Search terms, reasoned.** The slugs and titles follow common usage; no
  search volume was measured.

**What it forecloses.** Nothing that cannot be undone. The samples could
become starters, and the page could gain a sample.

**Added 2026-10-18: an e-invoice's XML.** Since
[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
the runtime writes the CII XML of a ZUGFeRD or Factur-X invoice in the EN
16931 profile, made for Germany alone, in a final render of a report that
carries one; the renderer refuses that render's document, so no PDF
carries the XML, and draws its preview, which writes none and is labelled
on every page as no e-invoice. "No e-invoice" above still holds of the
euro invoice's samples, which carry none, and nothing here writes
XRechnung or FatturaPA; of Formancy Report it no longer holds whole. As
"A limit another change will outdate" asks, the page says so again: in
each of its languages the sentence that says the PDF is no e-invoice now
says too that Formancy Report's source already writes that XML, for
Germany alone, and that nothing embeds it in a PDF yet, because the
renderer refuses one. Nothing fails when those words go stale either.
This record's register was read again and left as it was: its one line on
e-invoices speaks of the samples, which carry none, and 0027's register
says what an e-invoice costs. The change that draws the PDF/A-3 must say
so again on the page and here.

**Added 2026-10-18: an e-invoice drawn.** Since
[0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)
the renderer draws a final render of a report that carries an e-invoice
as a PDF/A-3b that embeds its XML, a ZUGFeRD or Factur-X invoice in the EN
16931 profile, made for Germany alone; the corpus's German e-invoice
samples are judged as PDFs by veraPDF and Mustang, and their XML by
Mustang and KoSIT, in the e-invoice gate. "No e-invoice" above still
holds of the euro invoice's samples, which carry none. As the addition
above asks, the page says so again: in each of its languages the sentence
that says the PDF is no e-invoice now says that the euro invoice's samples
are none, and that Formancy Report's source draws an e-invoice as such a
PDF for Germany, which those validators judge on the German samples, and
that France is not claimed. Nothing fails when those words go stale
either. This record's register was read again and left as it was: its one
line on e-invoices speaks of the samples, which still carry none, and
0027's and 0031's registers say what an e-invoice costs.

## Alternatives considered

**Samples that bill the starter's maintenance, translated, at the standard
rate.** One invoice seven ways, as the QR-bill's samples are. Wrong in
France and Ireland by the French administration's and Revenue's own pages,
and in Italy by secondary sources; Spain's reduced rate, by secondary
sources too, asks of materials a share the starter's parts exceed.

**The starter's maintenance at each country's applicable rate.** Reduced
rates with conditions: a customer's certificate in France, a boiler's
value split out in Italy, a 40 % test of materials in Spain, none of which
a test holds, and not the standard rate that was asked for.

**A business customer.** Italy reverses the charge on the maintenance of a
building's plant, as remembered and not re-read, and Ireland's reduced
rate applies whoever the customer is.

**Samples that carry every mention their countries ask.** A customer's
NIF and codice fiscale, a REA, KvK and Firmenbuch number, each invented
and failing its check where one exists. A codice fiscale is made from a
person's name, birth date and place, so a made-up one may be a real
person's; and each number is one more law nobody here read whole. France's
mentions, read from its administration's own page, are printed.

**Four samples instead of six**, de-AT, fr-FR, it-IT and en-IE, a sample for
each page's language to lead with. Two fewer translations nobody here
reads. Six give readers of Spanish and Dutch a sample too, and each of the
two costs one edition, one picture and one render case.

**fr-BE or nl-BE, fi-FI, pt-PT.** A Belgian payer expects a structured
communication, which the code holds only as text (0025); Finnish is a
language no page has and nobody here reads; Portugal asks an invoice for a
code of its own, as remembered and not re-read.

**The samples as starters.** The picker would offer seven euro invoices
that differ by country, and the gate would walk six more in both builders.

**A third manifest for the euro samples.** One more file for the script,
the pictures' test and the pages to read, for pictures of the same kind
as `samples.json`'s.

**One page for both codes.** 0024 rejected it, and the codes differ in
country, currency, slip and rules.

**The bank's name for the code, once, in the German lead,** as the design
proposed, or as the German slug. Its owner and its rules are unknown here
(0025), and the descriptive words name the code as well.

**Each page throwing its own status error,** as the QR-bill page's did.
Four lines repeated, and a release commit meeting the errors one after
the other.

**A link into the Studio at the euro invoice.** The Studio has no address
for a starter, and one is a change to it and its gate, for a later change.
