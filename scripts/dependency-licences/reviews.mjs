// What a review read, and the packages it admitted: tables `dependency-licences.mjs`
// judges the installed tree against, kept apart so that file holds the policy
// and this one the evidence. Each entry is dated, names the file it read and,
// where it admits a package for one dependent, which.

/**
 * Reviewed exceptions: `name@version`, or `name@version/path` for one font file,
 * to the licence the evidence shows and where that evidence is. `problems`
 * refuses an entry nothing installs, so one outlives its package by no more
 * than the release that drops it.
 *
 * - `png-js@1.1.0` reaches `@formancy/report-render-pdf` through pdfmake and
 *   PDFKit, and its package.json has no `license` field, as decision 0005
 *   predicted. The LICENSE file it ships is the MIT License, read on
 *   2026-10-15.
 */
export const EXCEPTIONS = Object.freeze({
  'png-js@1.1.0': { licence: 'MIT', evidence: 'LICENSE in the tarball: MIT License, Copyright (c) 2017 Devon Govett' },
})

/**
 * Formancy Data's packages, each admitted for the one package allowed to
 * depend on it (0006, extended 2026-10-16 by 0016 and 2026-10-22 by 0047):
 * `name@version` to the sha256 of the `LICENSE.md` their `SEE LICENSE IN`
 * pointer names, as the review read it, and the package whose dependency
 * it may be -- the provider for Data's client, the server for Data's
 * identity verifier, and neither for the other's. Data is on this
 * repository's terms under its own name, from the same rightsholder, so a
 * customer licenses the two together; it is still a source-available
 * licence, which the policy refuses from anybody else. Not a correction of
 * metadata, as an exception is: a second set of terms, read, at one
 * version. `problems` refuses an admission nothing installs.
 *
 * - Data 0.1.0, published 2026-10-16: `data-client` and the `data-core` it
 *   depends on ship the same `LICENSE.md`, the Formancy Data Source-Available
 *   Licence Version 1.1, in force from 11 October 2026 -- byte for byte the
 *   file at Data's tag v0.1.0, read that day.
 * - Data 0.3.0's `data-identity`, published 2026-10-21, the host identity
 *   verifier `@formancy/report-server` verifies tokens with (0047): its
 *   `LICENSE.md` is the same Version 1.1, byte for byte the file 0.1.0
 *   shipped, read on 2026-10-22. It depends on jose alone, which the policy
 *   judges like anybody's.
 */
export const FORMANCY_DATA = Object.freeze({
  '@formancy/data-client@0.1.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026',
  },
  '@formancy/data-core@0.1.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026',
  },
  '@formancy/data-identity@0.3.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-server',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026, the same bytes as 0.1.0 shipped',
  },
})

/**
 * Reviewed ICC profiles, by the SHA-256 of their bytes, each with what it
 * is, the licence sentence that grants it as the review read it, and where.
 * A profile states its copyright holder in its header and its `cprt` tag,
 * not its terms, so nothing here reads a licence from the file: a review
 * does, once, and the digest holds the bytes it read. Keyed by digest and
 * not by package, since the licence is the profile's whoever ships it, and
 * a profile one byte off is another profile nobody has read. `problems`
 * refuses an entry nothing installs, and one that records no sentence.
 *
 * - The ICC's sRGB2014.icc, which PDFKit 0.19.1 ships as
 *   `js/data/sRGB_IEC61966_2_1.icc` and embeds as the output intent of every
 *   PDF/A (pdfkit.js 5265), which an e-invoice is: its header and tags read
 *   an ICC v2 `mntr` RGB profile, `desc` "sRGB2014", `cprt` "Copyright
 *   International Color Consortium, 2015". Byte for byte the ICC's own file
 *   at https://registry.color.org/rgb-registry/profiles/sRGB2014.icc,
 *   compared on 2026-10-17. Its licence is the ICC's for every profile the
 *   ICC owns, on its profile library page, read that day. pdfmake's browser
 *   build carries the same 3,024 bytes as base64 inside a script, where
 *   this walk does not look; the renderer's browser test holds that copy to
 *   this digest.
 */
export const ICC_PROFILES = Object.freeze({
  'sha256:384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a': {
    profile: 'sRGB2014.icc, the International Color Consortium\'s ICC v2 sRGB profile (desc "sRGB2014", cprt "Copyright International Color Consortium, 2015")',
    licence:
      'This profile is made available by the International Color Consortium, and may be copied, distributed, embedded, made, used, and sold without restriction. Altered versions of this profile shall have the original identification and copyright information removed and shall not be misrepresented as the original profile.',
    evidence:
      'https://registry.color.org/profile-library/#license, read 2026-10-17, where "ICC is the copyright owner"; the file compared byte for byte with https://registry.color.org/rgb-registry/profiles/sRGB2014.icc that day',
  },
})

/**
 * Packages admitted for one dependent alone, at one exact version, by the
 * SHA-256 of the licence file a review read (0058, extending 0006 as 0016
 * and 0047 did for Formancy Data's packages): `name@version` to that file,
 * the package whose dependency it may be, and what the review read. The
 * policy judges them as any package; they are further refused at another
 * version of the name, because a new release is another layout and another
 * measurer nobody read, with another licence file, and from any other
 * package, so that no builder carries a charting library into an editor's
 * bundle. `problems` refuses an entry nothing installs.
 *
 * Read on 2026-11-12 from the installed packages:
 * - `echarts@6.1.0`'s `LICENSE` is the Apache License 2.0 with its "Apache
 *   ECharts Subcomponents" section: d3.js under BSD-3-Clause
 *   (`licenses/LICENSE-d3`, sha256 e1211892da0b0e0585b7aebe8f98c1274fba15bafe47fa1f4ee8a7a502c06304),
 *   which `src/util/number.ts`, every axis's, embeds. Its `NOTICE`
 *   (sha256 d491d358344f842685c1b1585970999db65fe30ecf7ef3867af8814f4016c016)
 *   reads "Apache ECharts, Copyright 2017-2026 The Apache Software
 *   Foundation".
 * - `zrender@6.1.0`'s `LICENSE` is the BSD 3-Clause License, Copyright (c)
 *   2017, Baidu Inc.
 * - `tslib@2.3.0`, beneath both, is not confined: its `LICENSE.txt`
 *   (0BSD, Copyright (c) Microsoft Corporation, sha256
 *   210b19e543130388c68654b7497e967119ce17145f66ab7d85688fbd70f08751) was
 *   read, and the policy judges it as any package's, since
 *   report-builder-angular and rxjs depend on tslib themselves.
 */
export const CONFINED = Object.freeze({
  'echarts@6.1.0': {
    licenceFile: { path: 'LICENSE', sha256: 'sha256:634293835b43a6dd2094fa39182a3d9a6b9ca43b7fdb9ac354e8037af2a3093a' },
    for: '@formancy/report-render-pdf',
    evidence: 'LICENSE in the tarball: Apache License 2.0 with its Apache ECharts Subcomponents section (d3.js, BSD-3-Clause), read 2026-11-12',
  },
  'zrender@6.1.0': {
    licenceFile: { path: 'LICENSE', sha256: 'sha256:a681e9d183c72b4af4856935893805eb48c08f0f5a3f260203db7444c20fb98a' },
    for: '@formancy/report-render-pdf',
    evidence: 'LICENSE in the tarball: BSD 3-Clause License, Copyright (c) 2017, Baidu Inc., read 2026-11-12',
  },
})
