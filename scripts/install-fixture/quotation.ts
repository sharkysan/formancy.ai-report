/*
 * The quotation starter of `@formancy/report-corpus`, written out: its
 * definition and its synthetic data, as a host would hold them, and the
 * firm's mark it prints at the head of its first page (0032), as the host
 * approved it. The corpus is private and never published, so the consumer
 * carries its own copy of the one starter it renders. Generated from the
 * corpus's QUOTATION, quotationData() and LOGO; a change to the starter is
 * copied here by hand, and report-render-pdf's install-fixture.test.ts and
 * the consumer's run say whether this copy is still the starter, and still
 * resolves and renders.
 */
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/**
 * The firm's mark, as the host holds the approved asset: the drawing
 * report-spec's cleanSvg writes, and the SHA-256 of those bytes, by which
 * the quotation declares it. Written as a literal: this file is a browser
 * host's too (guide-react.tsx), which has no node:crypto.
 */
export const logo = {
  digest: 'sha256:1c4cde5bb45bf4a799f0b91ade404ef1ffd986b13dcb52b200a0ac2066c56dcb',
  bytes: new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1f4e79"/><path d="M28 62 L60 32 L92 62" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 54 C70 68 74 76 74 82 A14 14 0 0 1 46 82 C46 76 50 68 60 54 Z" fill="#ffffff"/></svg>',
  ),
} as const

export const quotation: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'quotation',
  title: 'Offerte',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'address', size: 10 },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'grand', size: 10.5, bold: true },
    { id: 'sender', size: 8, color: '#555555' },
  ],
  datasets: {
    header: {
      id: 'quotation',
      fields: [
        { id: 'number', type: 'string', label: 'Nummer', nullable: false },
        { id: 'quotedOn', type: 'date', label: 'Datum', nullable: false },
        { id: 'validUntil', type: 'date', label: 'Gültig bis', nullable: false },
        { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
        { id: 'street', type: 'string', label: 'Strasse', nullable: false },
        { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
        { id: 'city', type: 'string', label: 'Ort', nullable: false },
        { id: 'contact', type: 'string', label: 'Kontakt', nullable: true },
        { id: 'supplier', type: 'string', label: 'Anbieter', nullable: false },
        { id: 'supplierAddress', type: 'string', label: 'Adresse des Anbieters', nullable: false },
        { id: 'supplierUid', type: 'string', label: 'UID des Anbieters', nullable: false },
      ],
    },
    detail: {
      id: 'quotation-lines',
      fields: [
        { id: 'article', type: 'string', label: 'Artikel', nullable: false },
        { id: 'description', type: 'string', label: 'Beschreibung', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
        { id: 'unit', type: 'string', label: 'Einheit', nullable: false },
        { id: 'unitPrice', type: 'decimal', label: 'Einzelpreis', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [{ id: 'logo', mediaType: 'image/svg+xml', digest: 'sha256:1c4cde5bb45bf4a799f0b91ade404ef1ffd986b13dcb52b200a0ac2066c56dcb' }],
  aggregates: [
    { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } },
    {
      id: 'total',
      fn: 'sum',
      of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } },
      rounding: { scale: 2, mode: 'half-away-from-zero', increment: '0.05' },
    },
  ],
  regions: {
    pageHeader: [
      {
        id: 'running-head',
        kind: 'text',
        style: 'small',
        content: [{ kind: 'text', text: 'Offerte ' }, { kind: 'field', field: { dataset: 'header', field: 'number' } }],
      },
    ],
    reportHeader: [
      { id: 'logo', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 42.52, height: 42.52, fit: 'contain' },
      { id: 'logo-gap', kind: 'spacer', height: 12 },
      {
        id: 'sender',
        kind: 'text',
        style: 'sender',
        content: [
          { kind: 'field', field: { dataset: 'header', field: 'supplier' } },
          { kind: 'text', text: ' · ' },
          { kind: 'field', field: { dataset: 'header', field: 'supplierAddress' } },
          { kind: 'text', text: ' · ' },
          { kind: 'field', field: { dataset: 'header', field: 'supplierUid' } },
          { kind: 'text', text: ' MWST' },
        ],
      },
      { id: 'sender-gap', kind: 'spacer', height: 12 },
      {
        id: 'addresses',
        kind: 'columns',
        columns: [
          {
            width: 'fill',
            components: [
              { id: 'customer', kind: 'text', style: 'address', content: [{ kind: 'field', field: { dataset: 'header', field: 'customer' } }] },
              {
                id: 'contact',
                kind: 'text',
                style: 'address',
                visibleWhen: { cel: 'header.contact != null' },
                content: [{ kind: 'text', text: 'z. Hd. ' }, { kind: 'field', field: { dataset: 'header', field: 'contact' } }],
              },
              { id: 'street', kind: 'text', style: 'address', content: [{ kind: 'field', field: { dataset: 'header', field: 'street' } }] },
              {
                id: 'city',
                kind: 'text',
                style: 'address',
                content: [
                  { kind: 'field', field: { dataset: 'header', field: 'postcode' } },
                  { kind: 'text', text: ' ' },
                  { kind: 'field', field: { dataset: 'header', field: 'city' } },
                ],
              },
            ],
          },
          {
            width: 190,
            components: [
              { id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Offerte' }] },
              {
                id: 'number',
                kind: 'text',
                content: [{ kind: 'text', text: 'Nummer: ' }, { kind: 'field', field: { dataset: 'header', field: 'number' } }],
              },
              {
                id: 'quoted-on',
                kind: 'text',
                content: [
                  { kind: 'text', text: 'Datum: ' },
                  { kind: 'field', field: { dataset: 'header', field: 'quotedOn' }, format: { kind: 'date', style: 'medium' } },
                ],
              },
              {
                id: 'valid-until',
                kind: 'text',
                content: [
                  { kind: 'text', text: 'Gültig bis: ' },
                  { kind: 'field', field: { dataset: 'header', field: 'validUntil' }, format: { kind: 'date', style: 'medium' } },
                ],
              },
            ],
          },
        ],
      },
      { id: 'head-gap', kind: 'spacer', height: 18 },
    ],
    body: [
      {
        id: 'positions',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'article', header: 'Artikel', width: 82, align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'article' } } },
          {
            id: 'description',
            header: 'Beschreibung',
            width: 'fill',
            align: 'left',
            value: { kind: 'field', field: { dataset: 'detail', field: 'description' } },
          },
          {
            id: 'quantity',
            header: 'Menge',
            width: 50,
            align: 'right',
            value: { kind: 'field', field: { dataset: 'detail', field: 'quantity' }, format: { kind: 'number', scale: 2, grouping: true } },
          },
          { id: 'unit', header: 'Einheit', width: 58, align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'unit' } } },
          {
            id: 'unit-price',
            header: 'Preis',
            width: 82,
            align: 'right',
            value: {
              kind: 'field',
              field: { dataset: 'detail', field: 'unitPrice' },
              format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
            },
          },
          {
            id: 'amount',
            header: 'Betrag',
            width: 92,
            align: 'right',
            value: {
              kind: 'field',
              field: { dataset: 'detail', field: 'amount' },
              format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
            },
          },
        ],
        sort: [{ field: { dataset: 'detail', field: 'article' }, direction: 'asc' }],
        totals: [
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Zwischensumme' } },
              {
                column: 'amount',
                value: {
                  kind: 'aggregate',
                  aggregate: 'subtotal',
                  over: 'report',
                  format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
                },
              },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'MWST 8.1 %' } },
              {
                column: 'amount',
                value: {
                  kind: 'expression',
                  expression: { cel: 'round(totals.subtotal * dec("0.081"), 2)' },
                  format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
                },
              },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Rundung' } },
              {
                column: 'amount',
                value: {
                  kind: 'expression',
                  expression: { cel: 'totals.total - (totals.subtotal + round(totals.subtotal * dec("0.081"), 2))' },
                  format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
                },
              },
            ],
          },
          {
            cells: [
              { column: 'article', value: { kind: 'text', text: 'Total' } },
              {
                column: 'amount',
                value: {
                  kind: 'aggregate',
                  aggregate: 'total',
                  over: 'report',
                  format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
                },
              },
            ],
            style: 'grand',
          },
        ],
        emptyText: 'Keine Positionen.',
        repeatHeader: true,
      },
    ],
    summary: [
      { id: 'summary-gap', kind: 'spacer', height: 12 },
      {
        id: 'validity',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Diese Offerte ist gültig bis ' },
          { kind: 'field', field: { dataset: 'header', field: 'validUntil' }, format: { kind: 'date', style: 'long' } },
          { kind: 'text', text: '.' },
        ],
      },
      { id: 'terms', kind: 'text', content: [{ kind: 'text', text: 'Zahlbar innert 30 Tagen netto.' }] },
    ],
    pageFooter: [
      {
        id: 'page-of',
        kind: 'text',
        style: 'footer',
        content: [{ kind: 'text', text: 'Seite ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' von ' }, { kind: 'pageCount' }],
      },
    ],
  },
  provenance: { kind: 'blank' },
}

export const quotationData: ReportData = {
  header: {
    number: 'Q-2026-0415',
    quotedOn: '2026-10-15',
    validUntil: '2026-11-14',
    customer: 'Bäckerei Müller AG',
    street: 'Hauptstrasse 12',
    postcode: '3011',
    city: 'Bern',
    contact: 'Herr Peter Kühni',
    supplier: 'Formancy Haustechnik AG',
    supplierAddress: 'Industriestrasse 7, 3052 Zollikofen',
    supplierUid: 'CHE-123.456.789',
  },
  detail: [
    { article: 'A-1012', description: 'Entsorgung Altfilter', quantity: '7.25', unit: 'kg', unitPrice: '1.85', amount: '13.41' },
    { article: 'A-1011', description: 'Austausch Druckdifferenzschalter', quantity: '1.00', unit: 'Stk', unitPrice: '1212.40', amount: '1212.40' },
    { article: 'A-1010', description: 'Kleinmaterial', quantity: '1.00', unit: 'Pausch.', unitPrice: '23.45', amount: '23.45' },
    { article: 'A-1009', description: 'Messprotokoll Luftmengen', quantity: '1.00', unit: 'Stk', unitPrice: '150.00', amount: '150.00' },
    { article: 'A-1008', description: 'Desinfektionsmittel für Wärmerad', quantity: '2.50', unit: 'l', unitPrice: '18.90', amount: '47.25' },
    { article: 'A-1007', description: 'Dichtungsband EPDM', quantity: '12.50', unit: 'm', unitPrice: '4.35', amount: '54.38' },
    { article: 'A-1006', description: 'Fahrzeugpauschale Region Bern', quantity: '1.00', unit: 'Pausch.', unitPrice: '65.00', amount: '65.00' },
    { article: 'A-1005', description: 'Reinigung Kondensatwanne', quantity: '1.00', unit: 'Pausch.', unitPrice: '95.00', amount: '95.00' },
    { article: 'A-1004', description: 'Arbeitszeit Servicetechniker', quantity: '3.75', unit: 'h', unitPrice: '128.00', amount: '480.00' },
    { article: 'A-1003', description: 'Keilriemen SPA 1250', quantity: '2.00', unit: 'Stk', unitPrice: '27.80', amount: '55.60' },
    { article: 'A-1002', description: 'Ersatzfilter F7 für Monoblock', quantity: '6.00', unit: 'Stk', unitPrice: '38.50', amount: '231.00' },
    {
      article: 'A-1001',
      description: 'Wartung Lüftungsanlage, Grundpauschale',
      quantity: '1.00',
      unit: 'Pausch.',
      unitPrice: '480.00',
      amount: '480.00',
    },
  ],
  completeness: { complete: true, captured: 12 },
  consistency: 'host-captured',
}
