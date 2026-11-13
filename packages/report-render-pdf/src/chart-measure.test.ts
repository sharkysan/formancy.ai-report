import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { describe, expect, test } from 'vitest'
import type { ChartFaces } from './chart-faces.js'
import { platform, withMeasurer, withPlatform } from './chart-measure.js'
import type { FaceWidths } from './engine.js'
import { fixture, TIMEOUT } from './testing/documents.js'
import { asked, fontString, layOut, measured, planned } from './testing/echarts.js'

/**
 * zrender's platform for one layout (`chart-measure.ts`): a chart's words
 * measured in the faces the report embeds, as pdfmake measures them, a
 * line as its face's, and no canvas and no image; and the platform put
 * back as it was after the layout, so that nothing of a render's measuring
 * outlives it -- in a host page's own ECharts, which measures through the
 * same process-wide platform, or in memory.
 *
 * One case reads V8's collector, which no public interface answers: what a
 * test still reaches is no proof that nothing else does, and only a
 * collection shows a render's widths were let go.
 */

/** Liberation Serif's faces, the corpus's host font, mapped as the report's serif. */
const SERIF = { serif: fixture('host-fonts').document.fonts!.serif! }

/** What the platform's measurer answers for `text` in `font`. */
const widthOf = (text: string, font: string | undefined): number => platform.measureText(text, font).width

/** A layout of `faces`' title alone, as ECharts lays one out. */
const titled = (faces: ChartFaces) => layOut({ title: { text: 'Umsatz nach Region', left: 0, top: 0, textStyle: faces.title!.font } }, 300, 100)

/** `widths`, counting each width asked of it. */
function counted(widths: FaceWidths): { readonly widths: FaceWidths; readonly asked: () => number } {
  let count = 0
  return {
    widths: {
      width: (...args) => {
        count += 1
        return widths.width(...args)
      },
    },
    asked: () => count,
  }
}

/**
 * V8's collector, which `--expose-gc` lets a script run: the flag set once
 * V8 has started, for the one context made to take `gc` from, and turned
 * off again, so that no other context of the worker's sees it.
 */
function collector(): () => void {
  setFlagsFromString('--expose-gc')
  try {
    return runInNewContext('gc') as () => void
  } finally {
    setFlagsFromString('--no-expose-gc')
  }
}

/** The rest of this turn let go, in which a WeakRef keeps what it was made of or dereferenced to. */
const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe("zrender's platform for one layout", () => {
  // ECharts places each word by the width zrender is answered, and pdfmake
  // prints it in the width pdfmake measures: a word answered in another
  // face, weight or size than it prints in stands beside its neighbour by
  // one width and prints in another, over it. Each word is the engine's
  // width in its own face, regular or bold, Roboto or a host's -- the
  // widths pdfmake 0.3.11 gave them, `engine.test.ts`'s -- and 国, zrender's
  // probe for a line, the face's line and never its width, which in Roboto
  // at 8 pt is the .notdef glyph's, 3.546875: Roboto's line at 8 pt,
  // 9.375 (2400/2048 em), and Liberation Serif's, 8.859375 (2268/2048 em).
  test(
    "answers a word in the width pdfmake measures it in, and 国 in its face's line",
    async () => {
      const roboto = await measured(planned(), {}, 'Umsatz')
      const serif = await measured(planned(SERIF), { font: 'serif' })
      const words = fontString(roboto.faces.words)
      const title = fontString(roboto.faces.title!)
      expect(
        withMeasurer(roboto.faces, roboto.widths, () => [
          widthOf('Umsatz nach Region', words),
          widthOf('-30.00', words),
          widthOf('Umsatz nach Region', title),
          widthOf('国', words),
          widthOf('国', title),
        ]),
      ).toEqual([73.19140625, 22.3046875, 73.5703125, 9.375, 9.375])
      const serifWords = fontString(serif.faces.words)
      expect(withMeasurer(serif.faces, serif.widths, () => [widthOf('Umsatz nach Region', serifWords), widthOf('国', serifWords)])).toEqual([
        66.6484375, 8.859375,
      ])
    },
    TIMEOUT,
  )

  // A font string the measurer was not handed is one nobody chose for the
  // chart -- zrender's own 12px sans-serif, which a pie's default label
  // layout measures in, another size or weight than a face's, or a face's
  // family without the digest that keeps its widths apart -- and a width
  // for it would be a guess: refused, naming the font, which is the
  // renderer's, and never the text, which is the report's.
  test(
    'refuses a font it was not handed',
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const words = faces.words.font
      const strays = [
        '12px sans-serif',
        `normal bold 8px ${words.fontFamily}`,
        `italic normal 8px ${words.fontFamily}`,
        `normal normal 9px ${words.fontFamily}`,
        'normal normal 8px Roboto',
        '',
      ]
      const refused = (font: string | undefined): string => {
        try {
          return `measured ${String(withMeasurer(faces, widths, () => widthOf('Geheimprojekt', font)))}`
        } catch (error) {
          return (error as Error).message
        }
      }
      expect([...strays, undefined].map(refused)).toEqual([
        ...strays.map((font) => `a chart's layout measured text in a font it was not handed: '${font}'`),
        "a chart's layout measured text in a font it was not handed: none",
      ])
      expect(refused(fontString(faces.words))).toMatch(/^measured \d/)
    },
    TIMEOUT,
  )

  // A canvas would measure in the browser's fonts, or in Node fail, and an
  // image would be fetched by its address: a chart's layout needs neither,
  // and asks for neither (`echarts.test.ts`, which counts each ask before
  // the refusal it meets, as here), so either asked for is refused, never
  // answered.
  test(
    'refuses a canvas and an image',
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const tried = (run: () => unknown): string => {
        try {
          run()
          return 'answered'
        } catch (error) {
          return (error as Error).message
        }
      }
      const { result, asked: record } = withMeasurer(faces, widths, () =>
        asked(() => [
          tried(() => platform.createCanvas()),
          tried(() =>
            platform.loadImage(
              'logo.png',
              () => undefined,
              () => undefined,
            ),
          ),
        ]),
      )
      expect(result).toEqual(["a chart's layout asked for a canvas", "a chart's layout asked for an image"])
      expect([record.canvases, record.images]).toEqual([1, 1])
    },
    TIMEOUT,
  )

  // zrender's platform is one for the process or the page, and a host's
  // page may run an ECharts of its own, which sets a platform of its own:
  // a measurer left behind would measure the host's charts in the
  // report's faces after a render, or refuse them, and a layout that threw
  // would leave it behind the more surely. Each of the three is put back
  // as the host set it, after a layout and after one that threw, and the
  // host's next layout asks its own measurer and never the render's
  // widths.
  test(
    'puts back the measurer, the canvas and the image loader it replaced, also when the layout throws',
    async () => {
      const { faces, widths: measuring } = await measured(planned(), {}, 'Umsatz')
      const { widths, asked: render } = counted(measuring)
      let hosts = 0
      const host = {
        measureText: (text: string) => {
          hosts += 1
          return { width: 4 * text.length }
        },
        createCanvas: () => {
          throw new Error("the host's canvas")
        },
        loadImage: () => {
          throw new Error("the host's image")
        },
      }
      // The host's platform stands for the rest of the case, and the process's own after it.
      withPlatform(
        () => host,
        () => {
          /** Which of the three stand as the host set them. */
          const hosted = (): boolean[] =>
            [platform.measureText, platform.createCanvas, platform.loadImage].map(
              (each, index) => each === [host.measureText, host.createCanvas, host.loadImage][index],
            )
          const during = withMeasurer(faces, widths, () => {
            titled(faces)
            return hosted()
          })
          expect(during).toEqual([false, false, false])
          expect(hosted()).toEqual([true, true, true])
          const failed = new Error('the layout failed')
          expect(() =>
            withMeasurer(faces, widths, () => {
              titled(faces)
              throw failed
            }),
          ).toThrow(failed)
          expect(hosted()).toEqual([true, true, true])
          const measuredByRender = render()
          expect(measuredByRender).toBeGreaterThan(0)
          expect(hosts).toBe(0)
          const after = asked(() =>
            layOut(
              { title: { text: 'Host chart', textStyle: { fontFamily: 'host-face', fontStyle: 'normal', fontWeight: 'normal', fontSize: 12 } } },
              300,
              100,
            ),
          )
          expect(after.asked.measures).toEqual([
            ['国', 'normal normal 12px host-face'],
            ['a', 'normal normal 12px host-face'],
            ['Host chart', 'normal normal 12px host-face'],
          ])
          expect(hosts).toBe(3)
          expect(render()).toBe(measuredByRender)
        },
      )
    },
    TIMEOUT,
  )

  // A render's widths hold the faces pdfmake opened for it, and through
  // them a PDFKit document that is never ended (`Engine.widths`): kept by
  // zrender's platform or by the measurer past the layout, they would keep
  // a firm's font in the process after its render, against 0043. Once the
  // layout has ended and the render has let its widths go, nothing the
  // measurer set holds them, and the collector frees them. That is the
  // measurer's half: a document or a font the engine kept elsewhere would
  // pass here, and is the render's to show. What zrender keeps is the
  // widths it was answered, by the words themselves and their font
  // strings, and nothing they were measured by. Collected up to three
  // times, a turn apart, so that an unlucky collection is not a failure
  // and a widths truly kept still is.
  test(
    'keeps nothing of the widths it measured by once the layout ends',
    async () => {
      const gc = collector()
      // The flag is off again: a context made after has no collector to call.
      expect(runInNewContext('typeof gc')).toBe('undefined')
      const laidOut = async (): Promise<WeakRef<FaceWidths>> => {
        const { faces, widths } = await measured(planned(SERIF), { font: 'serif' }, 'Umsatz')
        withMeasurer(faces, widths, () => titled(faces))
        return new WeakRef(widths)
      }
      const widths = await laidOut()
      for (let collection = 0; collection < 3; collection += 1) {
        await turn()
        gc()
        if (widths.deref() === undefined) break
      }
      expect(widths.deref()).toBeUndefined()
    },
    TIMEOUT,
  )

  // ECharts' layout is synchronous, and the measurer stands for one call:
  // a layout that awaited anything would go on measuring once the measurer
  // was put back -- in zrender's own estimate in Node, in the page's canvas
  // in a browser -- in no face the report chose, and its words would print
  // where those widths placed them. A promise returned is refused, with
  // the platform already as it was, and whether it rejects later is read,
  // so that the rejection does not surface as one nobody handled.
  test(
    'refuses a layout that returns a promise, with the platform put back first',
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const font = fontString(faces.words)
      const own = platform.measureText
      const back: boolean[] = []
      const refused = (lay: () => unknown): string => {
        try {
          withMeasurer(faces, widths, lay)
          return 'returned'
        } catch (error) {
          back.push(platform.measureText === own)
          return (error as Error).message
        }
      }
      let later: number | undefined
      const promised = "a chart's layout returned a promise, and would measure after its measurer was put back"
      expect(
        refused(async () => {
          await turn()
          later = widthOf('Umsatz', font)
        }),
      ).toBe(promised)
      expect(refused(() => Promise.reject(new Error('the layout failed later')))).toBe(promised)
      expect(back).toEqual([true, true])
      await turn()
      await turn()
      // Measured after the layout was refused, in zrender's own estimate and not in Roboto.
      expect(later).toBeDefined()
      expect(later).not.toBe(widths.width(faces.words.family, faces.words.face, faces.words.font.fontSize, 'Umsatz'))
    },
    TIMEOUT,
  )
})
