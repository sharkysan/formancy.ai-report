import { describe, expect, test } from 'vitest'
import { difference, treeLines } from '../apps/studio/scripts/accessible-tree.mjs'

/**
 * How the Studio's browser gate writes Chromium's accessibility tree of a
 * builder (apps/studio/scripts/accessible-tree.mjs), which it compares
 * between the React and the Angular builder (gate-parity.mjs). A repository
 * guard rather than a test of the Studio's suite, whose include is its
 * src/: a test file under apps/studio/scripts would be one the Studio's
 * suite never runs, and the release report fails that.
 *
 * Each case says which normalisation it holds, and the normalisation is
 * only what is not a role, a name, a description, a value or a state: a
 * case that let a difference of those through would let the two builders
 * apart through the gate. The nodes are in the shape
 * Accessibility.getFullAXTree returns; where a value is a real one, the
 * comment says where Chromium 156.0.8078.4 gave it, under Playwright
 * 1.64.1, on 2026-10-16.
 */

const role = (value) => ({ type: 'role', value })
const computed = (value) => ({ type: 'computedString', value })
const property = (name, type, value) => ({ name, value: { type, value } })

/** A node exposed to a screen reader, `children` by id. */
function node(nodeId, kind, name, { children = [], ...more } = {}) {
  return { nodeId, ignored: false, role: role(kind), ...(name === undefined ? {} : { name: computed(name) }), childIds: children, ...more }
}

const REGION = { role: 'region', name: 'Report editor' }

/** A region holding a form holding one field, `field` its node, the region's other nodes beside it. */
function editorWith(field, ...others) {
  return [node('1', 'region', 'Report editor', { children: ['2'] }), node('2', 'form', 'Report', { children: [field.nodeId] }), field, ...others]
}

describe('treeLines', () => {
  // A state, a value or a description left out would let two builders
  // apart in it compare as one: everything Chromium says of a node is a
  // line's, but a relation by id.
  test('writes each node’s role, name, description, value and states, a line each, indented by its depth', () => {
    // The grouped equipment's Book value column with a width refused, in the React builder.
    const width = node('3', 'spinbutton', 'Width (mm)', {
      description: computed('3076.81 points of width for the fixed widths of these columns, and the margins leave 510.24'),
      value: { type: 'number', value: 999 },
      properties: [property('invalid', 'token', 'true'), property('focusable', 'booleanOrUndefined', true), property('required', 'boolean', false)],
    })
    expect(treeLines(editorWith(width), REGION)).toEqual([
      'region "Report editor"',
      '  form "Report"',
      '    spinbutton "Width (mm)" description="3076.81 points of width for the fixed widths of these columns, and the margins leave 510.24" value=999 invalid="true" focusable=true required=false',
    ])
  })

  // A name is compared as Chromium computes it, capitals and all: the React
  // builder's outline groups, named after report-builder.css's capitals,
  // were "REPORT HEADER" where the Angular builder's were "Report header",
  // and a normalisation that folded case would have hidden it.
  test('keeps a name as Chromium computes it, capitals and all', () => {
    // The grouped equipment, opened, in each builder.
    const react = [node('1', 'region', 'Report editor', { children: ['2'] }), node('2', 'group', 'REPORT HEADER')]
    const angular = [node('1', 'region', 'Report editor', { children: ['2'] }), node('2', 'group', 'Report header')]
    expect(difference(treeLines(react, REGION), treeLines(angular, REGION))).not.toBeNull()
  })

  // The ids a relation points by are each framework's own; the name and the
  // description the relation gives are what a person meets, and stay.
  test('reads a relation by id as nothing, and keeps the name and the description it gives', () => {
    const field = (id, describedby, description) =>
      node(id, 'spinbutton', 'Width (mm)', {
        description: computed(description),
        properties: [
          property('describedby', 'idrefList', describedby),
          { name: 'labelledby', value: { type: 'nodeList', relatedNodes: [{ backendDOMNodeId: 425, text: 'Width (mm)' }] } },
          property('invalid', 'token', 'true'),
        ],
      })
    // The ids each builder gave the field's error, on the grouped equipment's Book value.
    const react = treeLines(editorWith(field('3', '_r_2_-field-1-error', 'Too wide.')), REGION)
    const angular = treeLines(editorWith(field('7', 'report-editor-2-equipment-value-1-error', 'Too wide.')), REGION)
    expect(react).toEqual(angular)
    expect(react[2]).toBe('    spinbutton "Width (mm)" description="Too wide." invalid="true"')
    expect(difference(react, treeLines(editorWith(field('3', '_r_2_-field-1-error', 'Too narrow.')), REGION))).not.toBeNull()
  })

  // The Angular builder's component hosts are elements with no role -- the
  // problems' list stands in one -- where the React builder's components
  // draw none; a screen reader passes through them, and so does this. One
  // that is named or described says something, and is compared.
  test('passes through a wrapper with no role and nothing said of it, and keeps one that says something', () => {
    const list = node('4', 'list', 'Problems')
    const react = [node('1', 'region', 'Report editor', { children: ['4'] }), list]
    const angular = [node('1', 'region', 'Report editor', { children: ['3'] }), node('3', 'generic', undefined, { children: ['5'] }), node('5', 'none', '', { children: ['4'] }), list]
    expect(treeLines(angular, REGION)).toEqual(treeLines(react, REGION))
    const named = [node('1', 'region', 'Report editor', { children: ['3'] }), node('3', 'generic', 'Problems', { children: ['4'] }), list]
    expect(treeLines(named, REGION)).toEqual(['region "Report editor"', '  generic "Problems"', '    list "Problems"'])
    const described = [node('1', 'region', 'Report editor', { children: ['3'] }), node('3', 'generic', '', { description: computed('Two problems.'), children: ['4'] }), list]
    expect(treeLines(described, REGION)).toEqual(['region "Report editor"', '  generic "" description="Two problems."', '    list "Problems"'])
  })

  // What Chromium does not expose -- a region's label hidden from the tree,
  // a pane the narrow layout does not draw -- is not a screen reader's, and
  // the text is compared in Playwright's snapshot; what is exposed under a
  // node that is not stays, at that node's depth.
  test('leaves out what Chromium does not expose, and the text, and keeps what is exposed under them', () => {
    const nodes = [
      node('1', 'region', 'Report editor', { children: ['2', '6', '7'] }),
      { nodeId: '2', ignored: true, ignoredReasons: [{ name: 'uninteresting' }], role: role('none'), childIds: ['3'] },
      node('3', 'button', 'Undo', { children: ['4'] }),
      node('4', 'StaticText', 'Undo', { children: ['5'] }),
      node('5', 'InlineTextBox', 'Undo'),
      { nodeId: '6', ignored: true, ignoredReasons: [{ name: 'ariaHiddenElement' }], role: role('generic'), childIds: [] },
      // A pane the narrow layout does not draw: a role and a name, and nobody's.
      { nodeId: '7', ignored: true, ignoredReasons: [{ name: 'notRendered' }], role: role('region'), name: computed('Design view, not the PDF'), childIds: [] },
    ]
    expect(treeLines(nodes, REGION)).toEqual(['region "Report editor"', '  button "Undo"'])
  })

  // A tree read in part, or a region the gate did not find, would compare
  // as two that agreed.
  test('refuses a region it does not find once, and a child it does not hold', () => {
    expect(() => treeLines([node('1', 'region', 'Preview')], REGION)).toThrow(/has 0 region named "Report editor"/)
    expect(() => treeLines([node('1', 'region', 'Report editor'), node('2', 'region', 'Report editor')], REGION)).toThrow(/has 2 region/)
    expect(() => treeLines([{ ...node('1', 'region', 'Report editor'), ignored: true }], REGION)).toThrow(/has 0 region/)
    expect(() => treeLines([node('1', 'region', 'Report editor', { children: ['9'] })], REGION)).toThrow(/a child 9 of a region it does not hold/)
  })
})

describe('difference', () => {
  // The gate fails on anything but null, and says what differs in a line
  // a person can act on: the lines one builder alone has, at their depth.
  test('is null for the same lines, and otherwise names the lines each alone has, at their depth', () => {
    expect(difference(['a', '  b'], ['a', '  b'])).toBeNull()
    expect(difference(['region "Report editor"', '  group "REPORT HEADER"'], ['region "Report editor"', '  group "Report header"'], { names: ['React', 'Angular'] })).toBe(
      'React alone has (1) group "REPORT HEADER"; Angular alone has (1) group "Report header"',
    )
    expect(difference(['a', 'b'], ['a'], { names: ['React', 'Angular'] })).toBe('React alone has (0) b; Angular has no line the other lacks')
    expect(difference(['a', 'b', 'c', 'd'], [], { limit: 2 })).toBe('one alone has (0) a | (0) b and 2 more; the other has no line the other lacks')
  })

  // The same controls in another order are another tab order and another
  // reading order: a difference, said where it starts.
  test('says where the same lines stand in another order', () => {
    expect(difference(['a', '  b', '  c'], ['a', '  c', '  b'], { names: ['React', 'Angular'] })).toBe('the same lines in another order, from line 2: React has (1) b where Angular has (1) c')
  })
})
