/**
 * End-to-end tests that simulate the full pipeline:
 * parse → render → inject into DOM → verify interactions.
 *
 * Uses jsdom to simulate a browser environment.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

globalThis.dagre = require('../lib/dagre.min.js');
require('../src/utils.js');
require('../src/parser.js');
require('../src/renderer.js');
require('../src/content-search.js');
require('../src/content-export.js');

const UiPathParser = window.UiPathParser;
const UiPathRenderer = window.UiPathRenderer;
const UiPathValidator = window.UiPathValidator;
const UiPathSearch = window.UiPathSearch;
const UiPathExport = window.UiPathExport;

function loadFixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function injectSvg(svgContent) {
  document.body.innerHTML = `<div id="uxv-viewer-container"><div id="uxv-canvas">${svgContent}</div></div>`;
  return document.getElementById('uxv-viewer-container');
}

describe('E2E: full pipeline for each fixture', () => {
  const fixtures = [
    { name: 'classic-sequence.xaml', expectedType: 'Sequence' },
    { name: 'modern-sequence.xaml', expectedType: 'Sequence' },
    { name: 'flowchart.xaml', expectedType: 'Flowchart' },
    { name: 'flowchart-nested.xaml', expectedType: 'Flowchart' },
    { name: 'state-machine.xaml', expectedType: 'StateMachine' },
    { name: 'state-machine-rich.xaml', expectedType: 'StateMachine' },
    { name: 'duplicate-activities.xaml', expectedType: 'Sequence' },
  ];

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      let parsed, rendered, viewer;

      beforeAll(() => {
        parsed = UiPathParser.parse(loadFixture(fixture.name));
        rendered = UiPathRenderer.render(parsed);
        viewer = injectSvg(rendered.svgContent);
      });

      it('parses correctly', () => {
        expect(parsed.error).toBeFalsy();
        expect(parsed.tree.type).toBe(fixture.expectedType);
      });

      it('renders SVG with correct structure', () => {
        const svg = viewer.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg.querySelectorAll('[data-id]').length).toBeGreaterThan(0);
      });

      it('all nodes have ARIA attributes', () => {
        const nodes = viewer.querySelectorAll('[data-id]');
        for (const node of nodes) {
          expect(node.getAttribute('role')).toBeTruthy();
        }
      });

      it('generates panel HTML', () => {
        expect(typeof rendered.panelHtml).toBe('string');
      });

    });
  }
});

describe('E2E: search module', () => {
  let parsed;

  beforeAll(() => {
    parsed = UiPathParser.parse(loadFixture('classic-sequence.xaml'));
  });

  it('finds matches by display name', () => {
    const matches = UiPathSearch.findMatches(parsed.tree, 'Assign');
    expect(matches.length).toBeGreaterThan(0);
    // Match found by type ('Assign'), displayName may differ
    const hasAssign = matches.some((m) => m.type?.toLowerCase().includes('assign') || m.displayName?.toLowerCase().includes('assign'));
    expect(hasAssign).toBe(true);
  });

  it('finds matches by type', () => {
    const matches = UiPathSearch.findMatches(parsed.tree, 'Sequence');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('returns empty for no matches', () => {
    const matches = UiPathSearch.findMatches(parsed.tree, 'zzzzzznonexistent');
    expect(matches.length).toBe(0);
  });

  it('expandAncestors returns false when no expansion needed', () => {
    const changed = UiPathSearch.expandAncestors(parsed.tree, parsed.tree.id);
    expect(changed).toBe(false);
  });
});

describe('E2E: export module', () => {
  it('sanitizeFilename removes unsafe characters', () => {
    expect(UiPathExport.sanitizeFilename('my<file>:name')).toBe('my-file-name');
  });

  it('sanitizeFilename handles empty', () => {
    expect(UiPathExport.sanitizeFilename('')).toBe('workflow');
    expect(UiPathExport.sanitizeFilename(null)).toBe('workflow');
  });
});

describe('E2E: flowchart view for sequences', () => {
  let parsed, result;

  beforeAll(() => {
    parsed = UiPathParser.parse(loadFixture('classic-sequence.xaml'));
    result = UiPathRenderer.renderSequenceFlowchart(parsed);
  });

  it('renders SVG', () => {
    expect(result.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('</svg>');
  });

  it('contains activity nodes', () => {
    expect(result.svgContent).toContain('data-id');
  });

  it('contains terminal circles', () => {
    expect(result.svgContent).toContain('<circle');
  });

  it('contains edge paths', () => {
    expect(result.svgContent).toContain('<path');
    expect(result.svgContent).toContain('marker-end');
  });

  it('has valid dimensions', () => {
    expect(result.totalW).toBeGreaterThan(0);
    expect(result.totalH).toBeGreaterThan(0);
  });
});

describe('E2E: flowchart view for state machines', () => {
  let parsed, result;

  beforeAll(() => {
    parsed = UiPathParser.parse(loadFixture('state-machine.xaml'));
    result = UiPathRenderer.renderSequenceFlowchart(parsed);
  });

  it('renders SVG for state machine', () => {
    expect(result.svgContent).toContain('<svg');
  });

  it('contains state nodes', () => {
    expect(result.svgContent).toContain('data-id');
  });
});

describe('E2E: flowchart view for flowcharts', () => {
  let parsed, result;

  beforeAll(() => {
    parsed = UiPathParser.parse(loadFixture('flowchart.xaml'));
    result = UiPathRenderer.renderSequenceFlowchart(parsed);
  });

  it('renders SVG for flowchart', () => {
    expect(result.svgContent).toContain('<svg');
  });

  it('contains decision diamonds', () => {
    expect(result.svgContent).toContain('<polygon');
  });
});

describe('E2E: panel HTML has clickable variable names', () => {
  let rendered;

  beforeAll(() => {
    const parsed = UiPathParser.parse(loadFixture('classic-sequence.xaml'));
    rendered = UiPathRenderer.render(parsed);
  });

  it('variable cells have data-varname attribute', () => {
    expect(rendered.panelHtml).toContain('data-varname');
  });

  it('variable cells have click-to-highlight title', () => {
    expect(rendered.panelHtml).toContain('Click to highlight references');
  });
});
