import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

require('../src/utils.js');
require('../src/content-fetch.js');
require('../src/parser.js');
const UiPathDiff = require('../src/diff.js');

const { diffTrees, diffChildLists, diffGraphNodeLists, countChanges, nodeKey,
  treeSnapshot, graphSnapshot, computeLCS, hasStableId } = UiPathDiff._test;

function loadFixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function makeNode({ id, type = 'Assign', displayName = 'Assign', properties = {}, children = [], variables = [] }) {
  return { id, type, displayName, category: 'data', annotation: null, properties, children, variables, collapsed: false };
}

describe('diff engine', () => {
  describe('diffTrees — identical trees', () => {
    it('marks identical trees as unchanged', () => {
      const old = makeNode({ id: 'A1', displayName: 'Set X' });
      const nw = makeNode({ id: 'A1', displayName: 'Set X' });
      const result = diffTrees(old, nw);
      expect(result._diffStatus).toBe('unchanged');
    });
  });

  describe('diffTrees — modified node', () => {
    it('detects displayName change', () => {
      const old = makeNode({ id: 'A1', displayName: 'Set X' });
      const nw = makeNode({ id: 'A1', displayName: 'Set Y' });
      const result = diffTrees(old, nw);
      expect(result._diffStatus).toBe('modified');
    });

    it('detects property change', () => {
      const old = makeNode({ id: 'A1', displayName: 'Set X', properties: { Value: '1' } });
      const nw = makeNode({ id: 'A1', displayName: 'Set X', properties: { Value: '2' } });
      const result = diffTrees(old, nw);
      expect(result._diffStatus).toBe('modified');
    });
  });

  describe('diffTrees — added/removed', () => {
    it('annotates new tree as added', () => {
      const nw = makeNode({ id: 'A1' });
      const result = diffTrees(null, nw);
      expect(result._diffStatus).toBe('added');
    });

    it('annotates removed tree', () => {
      const old = makeNode({ id: 'A1' });
      const result = diffTrees(old, null);
      expect(result._diffStatus).toBe('removed');
    });

    it('returns null for both null', () => {
      expect(diffTrees(null, null)).toBeNull();
    });
  });

  describe('diffChildLists — basic operations', () => {
    it('detects added child', () => {
      const oldList = [makeNode({ id: 'A1', displayName: 'First' })];
      const newList = [
        makeNode({ id: 'A1', displayName: 'First' }),
        makeNode({ id: 'A2', displayName: 'Second' }),
      ];
      const result = diffChildLists(oldList, newList);
      expect(result.length).toBe(2);
      expect(result[0]._diffStatus).toBe('unchanged');
      expect(result[1]._diffStatus).toBe('added');
    });

    it('detects removed child', () => {
      const oldList = [
        makeNode({ id: 'A1', displayName: 'First' }),
        makeNode({ id: 'A2', displayName: 'Second' }),
      ];
      const newList = [makeNode({ id: 'A1', displayName: 'First' })];
      const result = diffChildLists(oldList, newList);
      const removed = result.filter((r) => r._diffStatus === 'removed');
      expect(removed.length).toBe(1);
    });
  });

  describe('diffChildLists — duplicate activity names', () => {
    it('matches by stable id when names collide', () => {
      // Three "Assign" activities with different stable IDs and properties
      const oldList = [
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_2', displayName: 'Assign', properties: { Value: 'b' } }),
        makeNode({ id: 'Assign_3', displayName: 'Assign', properties: { Value: 'c' } }),
      ];
      // Reordered: 3, 1, 2
      const newList = [
        makeNode({ id: 'Assign_3', displayName: 'Assign', properties: { Value: 'c' } }),
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_2', displayName: 'Assign', properties: { Value: 'b' } }),
      ];

      const result = diffChildLists(oldList, newList);
      const nonRemoved = result.filter((r) => r._diffStatus !== 'removed');
      // All should be matched (unchanged), none should be modified
      for (const node of nonRemoved) {
        expect(node._diffStatus).toBe('unchanged');
      }
    });

    it('detects insertion among duplicates', () => {
      const oldList = [
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_2', displayName: 'Assign', properties: { Value: 'b' } }),
      ];
      const newList = [
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_NEW', displayName: 'Assign', properties: { Value: 'new' } }),
        makeNode({ id: 'Assign_2', displayName: 'Assign', properties: { Value: 'b' } }),
      ];

      const result = diffChildLists(oldList, newList);
      const added = result.filter((r) => r._diffStatus === 'added');
      const unchanged = result.filter((r) => r._diffStatus === 'unchanged');
      expect(added.length).toBe(1);
      expect(unchanged.length).toBe(2);
    });

    it('detects removal among duplicates', () => {
      const oldList = [
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_2', displayName: 'Assign', properties: { Value: 'b' } }),
        makeNode({ id: 'Assign_3', displayName: 'Assign', properties: { Value: 'c' } }),
      ];
      // Remove the middle one
      const newList = [
        makeNode({ id: 'Assign_1', displayName: 'Assign', properties: { Value: 'a' } }),
        makeNode({ id: 'Assign_3', displayName: 'Assign', properties: { Value: 'c' } }),
      ];

      const result = diffChildLists(oldList, newList);
      const removed = result.filter((r) => r._diffStatus === 'removed');
      const unchanged = result.filter((r) => r._diffStatus === 'unchanged');
      expect(removed.length).toBe(1);
      expect(unchanged.length).toBe(2);
    });
  });

  describe('countChanges', () => {
    it('counts changes in a diff tree', () => {
      const tree = makeNode({ id: 'S1', type: 'Sequence', displayName: 'Main', children: [] });
      tree._diffStatus = 'unchanged';
      tree.children = [
        { ...makeNode({ id: 'A1' }), _diffStatus: 'added' },
        { ...makeNode({ id: 'A2' }), _diffStatus: 'removed' },
        { ...makeNode({ id: 'A3' }), _diffStatus: 'modified' },
        { ...makeNode({ id: 'A4' }), _diffStatus: 'unchanged' },
      ];
      const changes = countChanges(tree);
      expect(changes.added).toBe(1);
      expect(changes.removed).toBe(1);
      expect(changes.modified).toBe(1);
    });
  });

  describe('computeLCS', () => {
    it('returns empty for empty arrays', () => {
      expect(computeLCS([], [])).toEqual([]);
    });

    it('returns empty when no common elements', () => {
      expect(computeLCS(['a', 'b'], ['c', 'd'])).toEqual([]);
    });

    it('finds LCS of identical arrays', () => {
      const pairs = computeLCS(['a', 'b', 'c'], ['a', 'b', 'c']);
      expect(pairs).toEqual([[0, 0], [1, 1], [2, 2]]);
    });

    it('finds LCS with reorder', () => {
      const pairs = computeLCS(['a', 'b', 'c'], ['c', 'a', 'b']);
      // LCS is [a, b] at old=[0,1] new=[1,2]
      expect(pairs).toEqual([[0, 1], [1, 2]]);
    });

    it('finds LCS with insertion', () => {
      const pairs = computeLCS(['a', 'b'], ['a', 'x', 'b']);
      expect(pairs).toEqual([[0, 0], [1, 2]]);
    });
  });

  describe('hasStableId', () => {
    it('returns true for XAML-derived ids', () => {
      expect(hasStableId({ id: 'Assign_1' })).toBe(true);
      expect(hasStableId({ id: 'FlowStep_1' })).toBe(true);
      expect(hasStableId({ id: 'Sequence_1' })).toBe(true);
    });

    it('returns false for parser-generated auto ids', () => {
      expect(hasStableId({ id: 'f_auto_1' })).toBe(false);
      expect(hasStableId({ id: 'n_auto_42' })).toBe(false);
    });

    it('returns falsy for missing id', () => {
      expect(hasStableId({ id: '' })).toBeFalsy();
      expect(hasStableId({ id: null })).toBeFalsy();
      expect(hasStableId({})).toBeFalsy();
    });
  });

  describe('diffGraphNodeLists', () => {
    function makeGraphNode({ id, flowType = 'FlowStep', activityType = 'Assign', displayName = 'Assign', properties = {} }) {
      return { id, flowType, activityType, displayName, category: 'data', annotation: null,
        isFinal: false, condition: '', expression: '', properties, innerActivity: null,
        refIds: [id], variables: [], children: undefined,
        flowNodes: undefined, flowEdges: undefined, stateNodes: undefined, stateEdges: undefined, entryNode: null };
    }

    it('matches identical graph nodes as unchanged', () => {
      const old = [makeGraphNode({ id: 'FS_1', displayName: 'Init' })];
      const nw = [makeGraphNode({ id: 'FS_1', displayName: 'Init' })];
      const result = diffGraphNodeLists(old, nw);
      expect(result.length).toBe(1);
      expect(result[0]._diffStatus).toBe('unchanged');
    });

    it('detects added graph node', () => {
      const old = [makeGraphNode({ id: 'FS_1' })];
      const nw = [makeGraphNode({ id: 'FS_1' }), makeGraphNode({ id: 'FS_2', displayName: 'New' })];
      const result = diffGraphNodeLists(old, nw);
      expect(result.filter((n) => n._diffStatus === 'added').length).toBe(1);
    });

    it('detects removed graph node', () => {
      const old = [makeGraphNode({ id: 'FS_1' }), makeGraphNode({ id: 'FS_2' })];
      const nw = [makeGraphNode({ id: 'FS_1' })];
      const result = diffGraphNodeLists(old, nw);
      expect(result.filter((n) => n._diffStatus === 'removed').length).toBe(1);
    });

    it('matches reordered graph nodes by stable id', () => {
      const old = [
        makeGraphNode({ id: 'FS_1', displayName: 'A' }),
        makeGraphNode({ id: 'FS_2', displayName: 'B' }),
      ];
      const nw = [
        makeGraphNode({ id: 'FS_2', displayName: 'B' }),
        makeGraphNode({ id: 'FS_1', displayName: 'A' }),
      ];
      const result = diffGraphNodeLists(old, nw);
      const nonRemoved = result.filter((n) => n._diffStatus !== 'removed');
      expect(nonRemoved.every((n) => n._diffStatus === 'unchanged')).toBe(true);
    });
  });

  describe('GitHub Enterprise URL derivation', () => {
    const { getApiBase, getRawBase } = UiPathDiff._test;

    it('returns api.github.com for github.com', () => {
      expect(getApiBase('github.com')).toBe('https://api.github.com');
    });

    it('returns /api/v3 for GHE hosts', () => {
      expect(getApiBase('github.mycompany.com')).toBe('https://github.mycompany.com/api/v3');
    });

    it('returns raw.githubusercontent.com for github.com', () => {
      expect(getRawBase('github.com')).toBe('https://raw.githubusercontent.com');
    });

    it('returns host for GHE raw', () => {
      expect(getRawBase('github.mycompany.com')).toBe('https://github.mycompany.com');
    });
  });

  describe('full workflow diff', () => {
    it('diffs a modified classic sequence', () => {
      const xml = loadFixture('classic-sequence.xaml');
      const oldTree = window.UiPathParser.parse(xml).tree;
      // Modify: change the last LogMessage's displayName
      const modifiedXml = xml.replace('DisplayName="Log End"', 'DisplayName="Log Finish"');
      const newTree = window.UiPathParser.parse(modifiedXml).tree;
      const result = diffTrees(oldTree, newTree);
      expect(result).not.toBeNull();
      const changes = countChanges(result);
      expect(changes.modified).toBeGreaterThanOrEqual(1);
      expect(changes.added).toBe(0);
      expect(changes.removed).toBe(0);
    });
  });
});
