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
 * - `pdfjs-dist@6.4.299` reaches `@formancy/report-mcp` (0089) and ships
 *   ten of Foxit's Type 1 faces in `standard_fonts/`, which have no name
 *   table to read. Beside them, `standard_fonts/LICENSE_FOXIT` (sha256
 *   b578cdd2345840ada550bd12519533812320d5f1d21cf4c1c7e1b1b0a31c98b7) is
 *   PDFium's BSD 3-Clause licence, "Copyright 2014 PDFium Authors", read
 *   on 2026-11-27. PDF.js reads one only for a PDF that does not embed its
 *   Courier, Times, Symbol or Zapf Dingbats, and only from the
 *   `standardFontDataUrl` it is given, which report-mcp gives none.
 */
const FOXIT_EVIDENCE = 'standard_fonts/LICENSE_FOXIT in the tarball: BSD 3-Clause, Copyright 2014 PDFium Authors, read 2026-11-27'
export const EXCEPTIONS = Object.freeze({
  'png-js@1.1.0': { licence: 'MIT', evidence: 'LICENSE in the tarball: MIT License, Copyright (c) 2017 Devon Govett' },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitDingbats.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitFixed.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitFixedBold.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitFixedBoldItalic.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitFixedItalic.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitSerif.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitSerifBold.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitSerifBoldItalic.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitSerifItalic.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
  'pdfjs-dist@6.4.299/standard_fonts/FoxitSymbol.pfb': { licence: 'BSD-3-Clause', evidence: FOXIT_EVIDENCE },
})

/**
 * Formancy Data's packages, each admitted for the one package allowed to
 * depend on it (0006, extended 2026-10-16 by 0016 and 2026-10-22 by 0047,
 * admitted again at Data 0.5.0 on 2026-11-27):
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
 * - Data 0.5.0, published 2026-11-23, admitted in place of both on
 *   2026-11-27: `data-client`, the `data-core` it depends on and
 *   `data-identity` each ship a `LICENSE.md` that is the same Version 1.1,
 *   byte for byte the file 0.1.0 and 0.3.0 shipped, read whole that day
 *   from the registry's tarballs, whose sha512 is the lockfile's. Their
 *   `NOTICE` is 0.1.0's too. data-core now brings `@formancy/spec` and
 *   `@formancy/expressions` 0.13.0, formancy's, under Apache-2.0, which the
 *   policy judges like anybody's.
 */
export const FORMANCY_DATA = Object.freeze({
  '@formancy/data-client@0.5.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026, the same bytes as 0.1.0 shipped',
  },
  '@formancy/data-core@0.5.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026, the same bytes as 0.1.0 shipped',
  },
  '@formancy/data-identity@0.5.0': {
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
 * - pdfjs-dist 6.4.299's `iccs/CGATS001Compat-v2-micro.icc` (0089): 8,464
 *   bytes of an ICC v2.1 input-class CMYK profile to Lab, `desc` "uCMY",
 *   `cprt` "CC0", which PDF.js reads only from the `iccUrl` it is given,
 *   to draw a CMYK image, and report-mcp gives none. Its terms are in the
 *   file, `cprt`, and beside it, `iccs/LICENSE` (sha256
 *   286e4fd7b447330b2c88e23890e3cd0a9d38cb398d4a59cb247f578ccbda3213),
 *   Creative Commons' CC0 1.0 Universal, read on 2026-11-27; not compared
 *   with the file it was made from.
 */
export const ICC_PROFILES = Object.freeze({
  'sha256:73e1ba37d2bad5bab2a964f40a9eed96209666efc067c3322626214bbef234a0': {
    profile: 'CGATS001Compat-v2-micro.icc, an ICC v2.1 input-class CMYK profile to Lab (desc "uCMY", cprt "CC0"), as pdfjs-dist 6.4.299 ships it',
    licence:
      'To the greatest extent permitted by, but not in contravention of, applicable law, Affirmer hereby overtly, fully, permanently, irrevocably and unconditionally waives, abandons, and surrenders all of Affirmer\'s Copyright and Related Rights and associated claims and causes of action, whether now known or unknown (including existing as well as future claims and causes of action), in the Work (i) in all territories worldwide, (ii) for the maximum duration provided by applicable law or treaty (including future time extensions), (iii) in any current or future medium and for any number of copies, and (iv) for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes (the "Waiver").',
    evidence: 'iccs/LICENSE in the tarball, CC0 1.0 Universal, its section 2, read 2026-11-27, and the cprt tag of the profile itself, "CC0"',
  },
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
 * the package whose dependency it may be, what the review read, and, in
 * `alsoRead`, the files beside the licence the review read too. The
 * policy judges them as any package; they are further refused at another
 * version of the name, because a new release is another layout and another
 * measurer nobody read, with another licence file, and from any other
 * package: no published package but the one it is for depends on it itself.
 * Reaching it through that package is allowed, and what a bundle holds is
 * the install gate's and the Studio's to prove, not this table's. `problems` refuses an entry nothing installs.
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
    alsoRead: [
      { path: 'NOTICE', sha256: 'sha256:d491d358344f842685c1b1585970999db65fe30ecf7ef3867af8814f4016c016' },
      { path: 'licenses/LICENSE-d3', sha256: 'sha256:e1211892da0b0e0585b7aebe8f98c1274fba15bafe47fa1f4ee8a7a502c06304' },
    ],
    for: '@formancy/report-render-pdf',
    evidence: 'LICENSE in the tarball: Apache License 2.0 with its Apache ECharts Subcomponents section (d3.js, BSD-3-Clause), read 2026-11-12',
  },
  'zrender@6.1.0': {
    licenceFile: { path: 'LICENSE', sha256: 'sha256:a681e9d183c72b4af4856935893805eb48c08f0f5a3f260203db7444c20fb98a' },
    for: '@formancy/report-render-pdf',
    evidence: 'LICENSE in the tarball: BSD 3-Clause License, Copyright (c) 2017, Baidu Inc., read 2026-11-12',
  },
})

/**
 * Fonts a package ships that the one published package admitted for never
 * loads, at one version, each by the SHA-256 of its bytes, with the
 * licence the review read and the test that shows it is never loaded
 * (0089, extending 0006 as 0058 did): `name@version` to the package it is
 * for, its fonts by path, the licence, `heldBy` and the evidence. The
 * policy refuses the licence; a package that never reads a file neither
 * embeds it in a customer's document nor draws with it, and what a
 * customer installs is the dependency's tarball, which npm fetches from
 * the registry with the licence beside the file. Refused at another
 * digest, depended on by any other published package, where nothing
 * installs it, and where `heldBy`, `file#test name`, names no case the
 * repository holds (`heldByProblems`). It admits, for the first time,
 * files under a licence the policy refuses: the owner admitted these four
 * on 28 November 2026, narrowly, as 0089 proposed them.
 *
 * - pdfjs-dist 6.4.299's `standard_fonts/LiberationSans-*.ttf`, Liberation
 *   Sans 1.07.4, whose name tables say "Licensed under the Liberation
 *   Fonts license" and whose `standard_fonts/LICENSE_LIBERATION` (sha256
 *   d2c4d5b3e115a519cb58eb691aa64538397e2611f9ebe801392cf9667997e7dc) is
 *   Red Hat's GPL-2.0 with a font-embedding exception, read on 2026-11-27,
 *   as 0006 read it on 2026-10-14. PDF.js reads one in place of a
 *   Helvetica or an Arial a PDF does not embed, only from the
 *   `standardFontDataUrl` it is given; report-mcp gives none, and
 *   `pdf-text.test.ts` reads a page in Helvetica, never embedded, with no
 *   file read.
 */
export const NEVER_LOADED = Object.freeze({
  'pdfjs-dist@6.4.299': Object.freeze({
    for: '@formancy/report-mcp',
    fonts: Object.freeze({
      'standard_fonts/LiberationSans-Bold.ttf': 'sha256:361c61b82d575c5c35fd9157fda8b0194bcfcd0d88ea8521a4fb5dd53d33dddc',
      'standard_fonts/LiberationSans-BoldItalic.ttf': 'sha256:a224075ac17495ad0a3af3bc0a419ac0704a8b3fd1095456201fb9b095fc281d',
      'standard_fonts/LiberationSans-Italic.ttf': 'sha256:832b4406dbef23628800d3aaad21048534ac84d7e3ad955be83b8172ed8ef512',
      'standard_fonts/LiberationSans-Regular.ttf': 'sha256:f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f',
    }),
    licence: "GPL-2.0 with Red Hat's font-embedding exception: Liberation Sans 1.07.4",
    heldBy: 'packages/report-mcp/src/pdf-text.test.ts#fetches nothing and reads no file, pdfjs-dist’s own standard fonts among them',
    evidence: "standard_fonts/LICENSE_LIBERATION in the tarball, and each face's name table, read 2026-11-27",
  }),
})

/**
 * Native builds a review read by the SBOM each ships, admitted for one
 * published package alone (0089, extending 0006 as 0058 did; the owner
 * admitted them on 28 November 2026): a family's name to the version a
 * review read, the package it is for, each build by the SHA-256 of its
 * `sbom.cdx.json`, and the components every build's SBOM lists whose
 * licence the policy refuses or that state none, each with its licence as
 * the SBOM writes it. A package that ships a `.node` file and is of no
 * family here is refused; so is one of a family at another version, a
 * build no review read, an SBOM of other bytes or of other components
 * beyond the policy, a route that does not pass the package it is for,
 * and, by the lockfile, a build or a version of the family that no
 * machine here installs and no review read (`lockfileProblems`).
 *
 * - `@napi-rs/canvas` 1.0.11, which pdfjs-dist 6.4.299 requires in Node
 *   where it is installed, and so loads in report-mcp's process from its
 *   first render check: its wrapper is MIT, judged as any package, and
 *   each of its eleven platform builds ships `skia.<platform>.node` and
 *   `sbom.cdx.json`, CycloneDX 1.6, which the review read from the
 *   registry's tarballs on 28 November 2026 -- 107 components each, 105
 *   for `linux-riscv64-gnu`, which lacks highway and libjxl, Apache-2.0
 *   and BSD-3-Clause. Beyond the policy, the same twelve in every build:
 *   four Rust crates under MPL-2.0 -- cssparser 0.38.0, cssparser-color
 *   0.6.0, cssparser-macros 0.7.0, dtoa-short 0.3.5 -- MPL-2.0 being
 *   file-level, asking nothing of a use that does not modify those files;
 *   FreeType under the FTL; ICU under the ICU licence, whose data the
 *   Windows builds ship beside as `icudtl.dat`; libjpeg-turbo under
 *   BSD-3-Clause, IJG and Zlib; libpng under libpng-2.0; unicode-ident
 *   under (MIT OR Apache-2.0) AND Unicode-3.0; fnv and siphasher, whose
 *   "Apache-2.0 / MIT" and "MIT/Apache-2.0" are no SPDX expressions; and
 *   the canvas crate itself, which states none and the package's manifest
 *   calls MIT. The SBOM names no Skia component, though the binary is
 *   Skia's build. pdfjs-dist asks for `^1.0.10`, so an integrator's
 *   install may resolve a later 1.x, which nobody here read.
 */
const CANVAS_BEYOND_POLICY = Object.freeze({
  'canvas@0.1.0': null,
  'cssparser-color@0.6.0': 'MPL-2.0',
  'cssparser-macros@0.7.0': 'MPL-2.0',
  'cssparser@0.38.0': 'MPL-2.0',
  'dtoa-short@0.3.5': 'MPL-2.0',
  'fnv@1.0.7': 'Apache-2.0 / MIT',
  'freetype@264b5fbf5b912b39f98d038bf75d39be0a73f21b': 'FTL',
  'icu@d578f2e8b7bd5938e21cfb6bf15c079e0aa5b738': 'ICU',
  'libjpeg-turbo@e14cbfaa85529d47f9f55b0f104a579c1061f9ad': 'BSD-3-Clause AND IJG AND Zlib',
  'libpng@d5515b5b8be3901aac04e5bd8bd5c89f287bcd33': 'libpng-2.0',
  'siphasher@1.0.3': 'MIT/Apache-2.0',
  'unicode-ident@1.0.24': '(MIT OR Apache-2.0) AND Unicode-3.0',
})
export const BUILDS_READ = Object.freeze({
  '@napi-rs/canvas': Object.freeze({
    version: '1.0.11',
    for: '@formancy/report-mcp',
    builds: Object.freeze({
      '@napi-rs/canvas-android-arm64': 'sha256:42b4aabaa377371df36a5fc80b5886572906780622a82152dce50f201048ef2b',
      '@napi-rs/canvas-darwin-arm64': 'sha256:fef97515c7a723fb72bdf087adde78d6897ac69b7211b5221a7093799a7395a1',
      '@napi-rs/canvas-darwin-x64': 'sha256:263001c3a829b9e2b407b5b05e6835aa44dd079693d2b166cba149f1750faf7e',
      '@napi-rs/canvas-linux-arm-gnueabihf': 'sha256:2f0fdd1f8eabe4e46e74cf91f4e568a68a656af27237dbb3735252f9e27c8cdd',
      '@napi-rs/canvas-linux-arm64-gnu': 'sha256:19ba0c193ca252822e955a7a08ee701a3b20cacbb84134b3378f17a4813a09b2',
      '@napi-rs/canvas-linux-arm64-musl': 'sha256:0958322e992b7f581543956f04c452403ab5b04f05995eb30d0eeb8f331d60ad',
      '@napi-rs/canvas-linux-riscv64-gnu': 'sha256:53f7a479f7765fa0efbd46e886de2529703b26564d8a6bc4cc5de662d9e61ac9',
      '@napi-rs/canvas-linux-x64-gnu': 'sha256:d9fdfe49bbc314cccce604ac3947866132539a0f76ebc0798c95b1ecb8c787f8',
      '@napi-rs/canvas-linux-x64-musl': 'sha256:54bc147b24708142fa7ef855c2c521cbdc87091991768d8daa1a37d63a208a61',
      '@napi-rs/canvas-win32-arm64-msvc': 'sha256:4bbe84478b9238821fedc9c97c3ba33bde81a0caf2a39d26fff606c907f59b44',
      '@napi-rs/canvas-win32-x64-msvc': 'sha256:af0b3af01a73d229ffabb515a7d6c0857784e359df39b0da59949e946415bf71',
    }),
    beyondPolicy: CANVAS_BEYOND_POLICY,
    evidence: "sbom.cdx.json of each build, read from the registry's 1.0.11 tarballs on 2026-11-28; the owner admitted them for report-mcp that day",
  }),
})
