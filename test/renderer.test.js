import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load dagre globally (required by renderer — UMD exports to module.exports in Node)
globalThis.dagre = require('../lib/dagre.min.js');
require('../src/utils.js');
require('../src/parser.js');
require('../src/renderer.js');

const UiPathParser = window.UiPathParser;
const UiPathRenderer = window.UiPathRenderer;

function loadFixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('UiPathRenderer', () => {
  describe('render — sequential workflow', () => {
    let result;
    beforeAll(() => {
      const parsed = UiPathParser.parse(loadFixture('classic-sequence.xaml'));
      result = UiPathRenderer.render(parsed);
    });

    it('returns an object with svgContent', () => {
      expect(result).toHaveProperty('svgContent');
      expect(result.svgContent).toContain('<svg');
      expect(result.svgContent).toContain('</svg>');
    });

    it('SVG contains activity nodes', () => {
      expect(result.svgContent).toContain('class="uxv-node"');
    });

    it('SVG contains container groups', () => {
      expect(result.svgContent).toContain('class="uxv-container"');
    });

    it('SVG contains arrowhead markers', () => {
      expect(result.svgContent).toContain('id="arrowhead"');
    });

    it('has positive dimensions', () => {
      expect(result.totalW).toBeGreaterThan(0);
      expect(result.totalH).toBeGreaterThan(0);
    });

    it('generates panel HTML with variables', () => {
      expect(result.panelHtml).toContain('Variables');
    });

  });

  describe('render — flowchart', () => {
    let result;
    beforeAll(() => {
      const parsed = UiPathParser.parse(loadFixture('flowchart.xaml'));
      result = UiPathRenderer.render(parsed);
    });

    it('renders flowchart SVG', () => {
      expect(result.svgContent).toContain('<svg');
    });

    it('contains decision diamond shapes', () => {
      expect(result.svgContent).toContain('<polygon');
    });

    it('contains multiple node groups', () => {
      // Flowchart should have multiple uxv-node elements for FlowSteps and FlowDecisions
      expect((result.svgContent.match(/class="uxv-node"/g) || []).length).toBeGreaterThan(1);
    });
  });

  describe('render — state machine', () => {
    let result;
    beforeAll(() => {
      const parsed = UiPathParser.parse(loadFixture('state-machine.xaml'));
      result = UiPathRenderer.render(parsed);
    });

    it('renders state machine SVG', () => {
      expect(result.svgContent).toContain('<svg');
    });

    it('contains state nodes', () => {
      expect(result.svgContent).toContain('data-type="State"');
    });

    it('contains initial state circle', () => {
      expect(result.svgContent).toContain('<circle');
    });
  });

  describe('render — error handling', () => {
    it('returns error string for invalid input', () => {
      const result = UiPathRenderer.render({ error: 'test error' });
      expect(typeof result).toBe('string');
      expect(result).toContain('test error');
    });
  });

  describe('COLORS', () => {
    it('exposes color map', () => {
      expect(UiPathRenderer.COLORS).toBeDefined();
      expect(UiPathRenderer.COLORS.control).toHaveProperty('bg');
      expect(UiPathRenderer.COLORS.control).toHaveProperty('border');
      expect(UiPathRenderer.COLORS.control).toHaveProperty('text');
    });
  });

  describe('isDarkMode', () => {
    it('is exposed as a function', () => {
      expect(typeof UiPathRenderer.isDarkMode).toBe('function');
    });

    it('returns false in default jsdom environment', () => {
      expect(UiPathRenderer.isDarkMode()).toBe(false);
    });
  });

  describe('SVG well-formedness', () => {
    const fixtures = [
      'classic-sequence.xaml',
      'modern-sequence.xaml',
      'flowchart.xaml',
      'flowchart-nested.xaml',
      'state-machine.xaml',
      'state-machine-rich.xaml',
      'duplicate-activities.xaml',
      'arguments.xaml',
    ];

    for (const name of fixtures) {
      it(`render(${name}) produces well-formed SVG`, () => {
        const parsed = UiPathParser.parse(loadFixture(name));
        if (parsed.error) return; // skip unparseable fixtures
        const result = UiPathRenderer.render(parsed);
        const wrapped = `<div xmlns="http://www.w3.org/1999/xhtml">${result.svgContent}</div>`;
        const doc = new DOMParser().parseFromString(wrapped, 'application/xhtml+xml');
        expect(doc.querySelector('parsererror')).toBeNull();
      });

      it(`renderSequenceFlowchart(${name}) produces well-formed SVG`, () => {
        const parsed = UiPathParser.parse(loadFixture(name));
        if (parsed.error) return;
        const result = UiPathRenderer.renderSequenceFlowchart(parsed);
        const wrapped = `<div xmlns="http://www.w3.org/1999/xhtml">${result.svgContent}</div>`;
        const doc = new DOMParser().parseFromString(wrapped, 'application/xhtml+xml');
        expect(doc.querySelector('parsererror')).toBeNull();
      });
    }
  });
});
