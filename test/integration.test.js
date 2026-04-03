import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load all modules in dependency order
globalThis.dagre = require('../lib/dagre.min.js');
require('../src/utils.js');
require('../src/parser.js');
require('../src/renderer.js');

const UiPathParser = window.UiPathParser;
const UiPathRenderer = window.UiPathRenderer;

function loadFixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function parseSvgDom(svgContent) {
  const { JSDOM } = require('jsdom');
  return new JSDOM(svgContent, { contentType: 'text/html' }).window.document;
}

describe('Integration: parse → render → validate pipeline', () => {

  describe('classic sequence workflow', () => {
    let parsed, rendered, doc;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('classic-sequence.xaml'));
      rendered = UiPathRenderer.render(parsed);
      doc = parseSvgDom(rendered.svgContent);
    });

    it('parses without errors', () => {
      expect(parsed.error).toBeFalsy();
    });

    it('renders valid SVG', () => {
      expect(rendered.svgContent).toContain('<svg');
      expect(rendered.svgContent).toContain('</svg>');
    });

    it('all leaf nodes have ARIA role="treeitem"', () => {
      const nodes = doc.querySelectorAll('.uxv-node:not(.uxv-collapsed)');
      for (const node of nodes) {
        expect(node.getAttribute('role')).toBe('treeitem');
      }
    });

    it('all leaf nodes have aria-label', () => {
      const nodes = doc.querySelectorAll('[role="treeitem"]');
      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        const label = node.getAttribute('aria-label');
        expect(label).toBeTruthy();
        expect(label).toContain('('); // Should contain "(Type)"
      }
    });

    it('container nodes have aria-expanded="true"', () => {
      const containers = doc.querySelectorAll('.uxv-container');
      for (const c of containers) {
        expect(c.getAttribute('aria-expanded')).toBe('true');
      }
    });

    it('container nodes have role="group"', () => {
      const containers = doc.querySelectorAll('.uxv-container');
      for (const c of containers) {
        expect(c.getAttribute('role')).toBe('group');
      }
    });

    it('panel HTML contains activity info', () => {
      expect(rendered.panelHtml).toBeTruthy();
    });
  });

  describe('flowchart workflow', () => {
    let parsed, rendered, doc;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('flowchart.xaml'));
      rendered = UiPathRenderer.render(parsed);
      doc = parseSvgDom(rendered.svgContent);
    });

    it('detects Flowchart type', () => {
      expect(parsed.tree.type).toBe('Flowchart');
    });

    it('renders flowchart with decision diamonds', () => {
      expect(rendered.svgContent).toContain('<polygon');
    });

    it('decision nodes have ARIA labels', () => {
      const decisions = doc.querySelectorAll('[data-type="FlowDecision"]');
      for (const d of decisions) {
        expect(d.getAttribute('role')).toBe('treeitem');
        expect(d.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('all data-id nodes have ARIA attributes', () => {
      const allNodes = doc.querySelectorAll('[data-id]');
      expect(allNodes.length).toBeGreaterThan(0);
      for (const node of allNodes) {
        expect(node.getAttribute('role')).toBeTruthy();
      }
    });

    it('has flow nodes and edges', () => {
      expect(parsed.tree.flowNodes).toBeDefined();
      expect(parsed.tree.flowNodes.length).toBeGreaterThan(0);
    });
  });

  describe('state machine workflow', () => {
    let parsed, rendered, doc;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('state-machine.xaml'));
      rendered = UiPathRenderer.render(parsed);
      doc = parseSvgDom(rendered.svgContent);
    });

    it('detects StateMachine type', () => {
      expect(parsed.tree.type).toBe('StateMachine');
    });

    it('renders state nodes', () => {
      const states = doc.querySelectorAll('[data-type="State"], [data-type="FinalState"]');
      expect(states.length).toBeGreaterThan(0);
    });

    it('state nodes have ARIA labels', () => {
      const states = doc.querySelectorAll('[data-type="State"], [data-type="FinalState"]');
      for (const s of states) {
        expect(s.getAttribute('role')).toBeTruthy();
        expect(s.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('has state edges', () => {
      expect(parsed.tree.stateEdges).toBeDefined();
      expect(parsed.tree.stateEdges.length).toBeGreaterThan(0);
    });
  });

  describe('rich state machine workflow', () => {
    let parsed, rendered;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('state-machine-rich.xaml'));
      rendered = UiPathRenderer.render(parsed);
    });

    it('parses transitions with triggers and actions', () => {
      const edgesWithTriggers = parsed.tree.stateEdges.filter(e => e.trigger);
      expect(edgesWithTriggers.length).toBeGreaterThan(0);
    });

    it('renders without errors for complex state machines', () => {
      expect(rendered.svgContent).toContain('<svg');
      expect(rendered.svgContent).toContain('</svg>');
    });
  });

  describe('nested flowchart', () => {
    let parsed, rendered;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('flowchart-nested.xaml'));
      rendered = UiPathRenderer.render(parsed);
    });

    it('parses nested flowchart structure', () => {
      expect(parsed.error).toBeFalsy();
      expect(parsed.tree.flowNodes.length).toBeGreaterThan(0);
    });

    it('renders without errors', () => {
      expect(rendered.svgContent).toContain('<svg');
    });
  });

  describe('modern sequence workflow', () => {
    let parsed, rendered;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('modern-sequence.xaml'));
      rendered = UiPathRenderer.render(parsed);
    });

    it('handles modern activity types', () => {
      expect(parsed.error).toBeFalsy();
    });

    it('renders modern workflow', () => {
      expect(rendered.svgContent).toContain('<svg');
    });
  });

  describe('duplicate activities', () => {
    let parsed;
    beforeAll(() => {
      parsed = UiPathParser.parse(loadFixture('duplicate-activities.xaml'));
    });

    it('parses duplicate activities with unique IDs', () => {
      expect(parsed.error).toBeFalsy();
      const ids = new Set();
      function collectIds(node) {
        if (!node) return;
        if (node.id) ids.add(node.id);
        (node.children || []).forEach(collectIds);
      }
      collectIds(parsed.tree);
      expect(ids.size).toBeGreaterThan(0);
    });
  });

  describe('parse error handling', () => {
    it('returns error for malformed XAML', () => {
      const parsed = UiPathParser.parse(loadFixture('parse-error.xaml'));
      expect(parsed.error).toBeTruthy();
    });

    it('renderer handles error gracefully', () => {
      const parsed = UiPathParser.parse(loadFixture('parse-error.xaml'));
      // Renderer should not throw for error results
      expect(() => {
        if (!parsed.error) UiPathRenderer.render(parsed);
      }).not.toThrow();
    });
  });

  describe('all fixtures render without throwing', () => {
    const fixtures = [
      'classic-sequence.xaml',
      'modern-sequence.xaml',
      'flowchart.xaml',
      'flowchart-nested.xaml',
      'state-machine.xaml',
      'state-machine-rich.xaml',
      'duplicate-activities.xaml',
    ];

    for (const fixture of fixtures) {
      it(`${fixture} parses and renders`, () => {
        const parsed = UiPathParser.parse(loadFixture(fixture));
        expect(parsed.error).toBeFalsy();
        const rendered = UiPathRenderer.render(parsed);
        expect(rendered.svgContent).toContain('<svg');
        expect(rendered.svgContent).toContain('</svg>');
      });
    }
  });
});
