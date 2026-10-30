// What a run of the e-invoice gate leaves in scripts/e-invoice/recorded/
// (0027, 0031), which the judges' tests read: each text as the run wrote
// it, with the line ends the repository keeps and without the machine's
// path to the repository; and the recorded corpus held to the one the
// runtime writes now, its XML byte for byte and its PDFs by their inflated
// objects (report-corpus's `inflatedDigest`), which no zlib changes.

/** The repository's root, as what is recorded writes it: no angle brackets, since an XML report holds it in its text. */
export const ROOT = '{repository}'

/**
 * `text` as it is recorded: its lines ended with a line feed, as the
 * repository's .gitattributes keeps every text file -- a JVM on Windows
 * ends its console's lines, and Mustang its report, with CR LF -- and every
 * spelling of `root`, the repository on the machine that ran the gate,
 * written `ROOT`: as given, with its backslashes doubled, which is how a
 * JSON string spells a Windows path, and with forward slashes, which is how
 * a file URI and a Java class path spell it, and cut short with an
 * ellipsis, as KoSIT's console table cuts a long path. KoSIT and veraPDF
 * name each file they read by its path, and Mustang its own JAR's; a path
 * names the machine and whoever ran it, and nothing the judges read
 * depends on one.
 */
export function recordedText(text, root) {
  const forward = root.replaceAll('\\', '/')
  const escaped = root.replaceAll('\\', '\\\\')
  let recorded = String(text).replaceAll('\r\n', '\n').replaceAll(escaped, ROOT).replaceAll(root, ROOT).replaceAll(forward, ROOT)
  // The longest cut first, so that a shorter one never leaves the rest of a longer.
  for (let length = forward.length - 1; length >= 4; length -= 1) recorded = recorded.replaceAll(`${forward.slice(0, length)}...`, `${ROOT}...`)
  return recorded
}

/** What stands in a recorded KoSIT console where its results table was. */
export const TABLE_LEFT_OUT =
  '[The results table is left out of the record: it names every file by its path, wrapping it across lines no replacement can follow, and each file’s report, recorded beside this, says what its row said.]'

/**
 * KoSIT's console as it is recorded: `recordedText`, and without its
 * results table, from the line `Results:` through the rule that closes the
 * table. The table's cells wrap a path across lines, cut at the column's
 * edge, so that a path in it cannot be found whole to replace. What the
 * judges read of the console -- the version, the configuration, the counts
 * -- stands outside it.
 */
export function recordedConsole(text, root) {
  const lines = recordedText(text, root).split('\n')
  const start = lines.indexOf('Results:')
  if (start === -1) return lines.join('\n')
  const rules = lines.map((line, index) => (index > start && /^-{20,}$/.test(line) ? index : -1)).filter((index) => index !== -1)
  // The table opens with a rule under `Results:` and closes with a second.
  const end = rules[1]
  if (end === undefined) throw new Error('KoSIT’s console has a results table that does not close')
  return [...lines.slice(0, start + 1), TABLE_LEFT_OUT, ...lines.slice(end + 1)].join('\n')
}

/** The command that records a run again, as a sentence names it. */
const RECORD = 'run node scripts/e-invoice.mjs --record, and commit what it writes'

/**
 * Every way the recorded corpus is not what this run judged, as sentences:
 * an XML file whose recorded text differs, a PDF whose recorded digest of
 * its inflated objects differs from the one this run drew (`entry.digest`),
 * one not recorded, and one recorded that the run did not make. `recorded`
 * maps each recorded XML file's name to its text, `pdfs` each recorded
 * PDF's to its digest. The judges' tests read the recorded corpus and the
 * tools' outputs on it, so a corpus left stale -- the runtime's XML or the
 * renderer's PDF changed, a control added -- would leave them holding the
 * judges to files the gate no longer judges.
 */
export function staleRecorded(entries, recorded, pdfs = new Map()) {
  const problems = []
  for (const entry of entries) {
    const { file } = entry
    if (entry.format === 'pdf') {
      if (!pdfs.has(file)) problems.push(`scripts/e-invoice/recorded/run.json records no ${file}, which this run judged: ${RECORD}`)
      else if (pdfs.get(file) !== entry.digest)
        problems.push(`scripts/e-invoice/recorded/run.json records ${file} as another PDF than this run drew, its objects inflated: ${RECORD}`)
    } else if (!recorded.has(file)) problems.push(`scripts/e-invoice/recorded/corpus/ holds no ${file}, which this run judged: ${RECORD}`)
    else if (recorded.get(file) !== entry.xml) problems.push(`scripts/e-invoice/recorded/corpus/${file} is not the XML this run judged: ${RECORD}`)
  }
  const made = new Set(entries.map(({ file }) => file))
  for (const file of recorded.keys()) if (!made.has(file)) problems.push(`scripts/e-invoice/recorded/corpus/${file} is no file this run judged: ${RECORD}`)
  for (const file of pdfs.keys())
    if (!made.has(file)) problems.push(`scripts/e-invoice/recorded/run.json records ${file}, which this run did not judge: ${RECORD}`)
  return problems
}
