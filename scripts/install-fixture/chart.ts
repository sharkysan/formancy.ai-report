/*
 * The guide's chart (docs/getting-started.md, 2) from outside the workspace:
 * the quotation with a bar of its lines' amounts in its summary, on the
 * guide's three lines. The runtime totals and formats every number the chart
 * prints, exactly, so the last tick of a 480.00 bar is 500, and the renderer
 * draws the block it hands over, with the chart's code loaded because this
 * document has one. consume.ts runs it. It lives apart because it changes
 * when the chart does, not when the rest of the API does.
 */
import { CHART_KINDS, CHART_PALETTE } from '@formancy/report-spec'
import type { ChartComponent } from '@formancy/report-spec'
import { MAX_CHART_CATEGORIES, resolveReport } from '@formancy/report-runtime'
import type { Chart, ImageResolver, Resolution } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'
import { quotation, quotationData } from './quotation.js'

export async function chartDrawn(images: ImageResolver): Promise<void> {
  const amounts: ChartComponent = {
    id: 'amounts',
    kind: 'chart',
    chart: 'bar',
    dataset: 'detail',
    width: 480,
    height: 160,
    category: { field: { dataset: 'detail', field: 'description' }, order: 'data' },
    series: [{ id: 'amount', label: 'Amount', fn: 'sum', of: { dataset: 'detail', field: 'amount' } }],
    valueFormat: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
    valueLabels: true,
    emptyText: 'No lines.',
  }
  const charted: Resolution = resolveReport(
    { ...quotation, regions: { ...quotation.regions, summary: [...quotation.regions.summary, amounts] } },
    {
      ...quotationData,
      // The guide's three lines, in the starter's fields. The starter's own
      // descriptions are too wide for a slot of this chart, which the renderer
      // refuses rather than clip.
      detail: [
        { article: 'A-1001', description: 'Maintenance, flat rate', quantity: '1.00', unit: 'Pausch.', unitPrice: '480.00', amount: '480.00' },
        { article: 'A-1002', description: 'Filter F7', quantity: '6.00', unit: 'Stk', unitPrice: '38.50', amount: '231.00' },
        { article: 'A-1004', description: 'Technician', quantity: '3.75', unit: 'h', unitPrice: '128.00', amount: '480.00' },
      ],
      completeness: { complete: true, captured: 3 },
    },
    { mode: 'final', images, creationDate: '2026-10-15T08:00:00Z' },
  )
  if (!charted.ok) throw new Error(`the quotation with a chart was refused: ${charted.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const drawn = charted.document.body.find((block): block is Chart => block.kind === 'chart')
  if (
    !CHART_KINDS.includes(amounts.chart) ||
    drawn?.chart !== 'bar' ||
    drawn.categories.length !== 3 ||
    drawn.categories.length > MAX_CHART_CATEGORIES ||
    drawn.series[0]?.color !== CHART_PALETTE[0] ||
    drawn.ticks.at(-1)?.exact !== '500' ||
    drawn.series[0].values.map((value) => value?.exact).join() !== '480.00,231.00,480.00'
  )
    throw new Error('the quotation with a chart did not resolve to a bar of three categories whose last tick is 500')
  const chartPdf = await renderPdf(charted.document, { maxPages: 50 })
  if (new TextDecoder().decode(chartPdf.subarray(0, 5)) !== '%PDF-') throw new Error('the quotation with a chart did not render to a PDF')
}
