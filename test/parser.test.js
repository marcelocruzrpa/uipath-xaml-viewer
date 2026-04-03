import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const UiPathParser = require('../src/parser.js');

function loadFixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('UiPathParser', () => {
  describe('classic sequence', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('classic-sequence.xaml')); });

    it('parses without error', () => {
      expect(result.error).toBeUndefined();
    });

    it('root is a Sequence', () => {
      expect(result.tree.type).toBe('Sequence');
      expect(result.tree.displayName).toBe('Main Sequence');
    });

    it('has stable IdRef-based id', () => {
      expect(result.tree.id).toBe('Sequence_1');
    });

    it('parses scoped variables', () => {
      expect(result.tree.variables).toHaveLength(2);
      expect(result.tree.variables[0].name).toBe('userName');
      expect(result.tree.variables[1].name).toBe('counter');
    });

    it('parses children correctly', () => {
      const children = result.tree.children;
      expect(children.length).toBe(4);
      expect(children[0].type).toBe('LogMessage');
      expect(children[0].displayName).toBe('Log Start');
      expect(children[1].type).toBe('Assign');
      expect(children[2].type).toBe('If');
      expect(children[3].type).toBe('LogMessage');
    });

    it('parses If branches', () => {
      const ifNode = result.tree.children[2];
      expect(ifNode.children.length).toBeGreaterThanOrEqual(2);
    });

  });

  describe('modern sequence', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('modern-sequence.xaml')); });

    it('parses children', () => {
      expect(result.tree.children.length).toBe(3);
      expect(result.tree.children[0].type).toBe('UseApplication');
      expect(result.tree.children[1].type).toBe('Assign');
      expect(result.tree.children[2].type).toBe('LogMessage');
    });
  });

  describe('flowchart', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('flowchart.xaml')); });

    it('root is Flowchart', () => {
      expect(result.tree.type).toBe('Flowchart');
    });

    it('has flow nodes', () => {
      // 3 FlowSteps + 1 FlowDecision
      expect(result.tree.flowNodes.length).toBe(4);
    });

    it('has a FlowDecision node', () => {
      const decision = result.tree.flowNodes.find((n) => n.flowType === 'FlowDecision');
      expect(decision).toBeDefined();
      expect(decision.displayName).toBe('Is Valid?');
    });

    it('has flow edges array', () => {
      expect(result.tree.flowEdges).toBeDefined();
      expect(Array.isArray(result.tree.flowEdges)).toBe(true);
    });

    it('FlowStep has innerActivity', () => {
      const step = result.tree.flowNodes.find((n) => n.flowType === 'FlowStep');
      expect(step).toBeDefined();
      expect(step.innerActivity).not.toBeNull();
      expect(step.activityType).toBe('Assign');
    });
  });

  describe('flowchart with nested sequence', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('flowchart-nested.xaml')); });

    it('FlowStep wrapping Sequence stores innerActivity', () => {
      const step1 = result.tree.flowNodes.find((n) => n.id === 'FlowStep_1');
      expect(step1).toBeDefined();
      expect(step1.innerActivity).not.toBeNull();
      expect(step1.innerActivity.type).toBe('Sequence');
    });

    it('innerActivity Sequence has children', () => {
      const step1 = result.tree.flowNodes.find((n) => n.id === 'FlowStep_1');
      expect(step1.innerActivity.children.length).toBe(3);
      expect(step1.innerActivity.children[0].type).toBe('Assign');
      expect(step1.innerActivity.children[1].type).toBe('Assign');
      expect(step1.innerActivity.children[2].type).toBe('LogMessage');
    });

  });

  describe('state machine', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('state-machine.xaml')); });

    it('root is StateMachine', () => {
      expect(result.tree.type).toBe('StateMachine');
    });

    it('has state nodes', () => {
      expect(result.tree.stateNodes.length).toBe(3);
    });

    it('has a FinalState', () => {
      const final = result.tree.stateNodes.find((n) => n.isFinal);
      expect(final).toBeDefined();
      expect(final.displayName).toBe('End');
    });

    it('state entry has activities', () => {
      const processing = result.tree.stateNodes.find((n) => n.displayName === 'Processing');
      expect(processing).toBeDefined();
      expect(processing.entryNode).not.toBeNull();
    });

    it('has state edges', () => {
      expect(result.tree.stateEdges.length).toBeGreaterThan(0);
    });
  });

  describe('state machine with triggers and actions', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('state-machine-rich.xaml')); });

    it('parses without error', () => {
      expect(result.error).toBeUndefined();
    });

    it('parses trigger on transition edge', () => {
      const edge = result.tree.stateEdges.find((e) => e.label === 'Start Processing');
      expect(edge).toBeDefined();
      expect(edge.trigger).not.toBeNull();
      expect(edge.trigger.type).toBe('LogMessage');
    });

    it('parses action on transition edge', () => {
      const edge = result.tree.stateEdges.find((e) => e.label === 'Start Processing');
      expect(edge.action).not.toBeNull();
      expect(edge.action.type).toBe('Assign');
    });

    it('parses condition on transition edge', () => {
      const edge = result.tree.stateEdges.find((e) => e.label === 'Start Processing');
      expect(edge.condition).toBeTruthy();
    });

    it('edges without trigger/action have null', () => {
      const edge = result.tree.stateEdges.find((e) => e.label === 'Complete');
      expect(edge).toBeDefined();
      expect(edge.trigger).toBeNull();
      expect(edge.action).toBeNull();
    });
  });

  describe('duplicate activities', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('duplicate-activities.xaml')); });

    it('all Assign nodes have unique stable ids', () => {
      const assigns = result.tree.children.filter((c) => c.type === 'Assign');
      expect(assigns.length).toBe(3);
      const ids = assigns.map((a) => a.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toContain('Assign_1');
      expect(ids).toContain('Assign_2');
      expect(ids).toContain('Assign_3');
    });

    it('all Assign nodes share the same displayName', () => {
      const assigns = result.tree.children.filter((c) => c.type === 'Assign');
      expect(assigns.every((a) => a.displayName === 'Assign')).toBe(true);
    });

    it('all LogMessage nodes have unique stable ids', () => {
      const logs = result.tree.children.filter((c) => c.type === 'LogMessage');
      expect(logs.length).toBe(3);
      const ids = logs.map((l) => l.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('parse error', () => {
    it('returns error for malformed XML', () => {
      const result = UiPathParser.parse(loadFixture('parse-error.xaml'));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to parse');
    });
  });

  describe('arguments type cleaning', () => {
    let result;
    beforeAll(() => { result = UiPathParser.parse(loadFixture('arguments.xaml')); });

    it('parses without error', () => {
      expect(result.error).toBeUndefined();
    });

    it('strips InArgument wrapper from type', () => {
      const arg = result.arguments.find((a) => a.name === 'inputText');
      expect(arg).toBeDefined();
      expect(arg.type).toBe('String');
      expect(arg.direction).toBe('In');
    });

    it('strips OutArgument wrapper from type', () => {
      const arg = result.arguments.find((a) => a.name === 'outputCount');
      expect(arg).toBeDefined();
      expect(arg.type).toBe('Int32');
      expect(arg.direction).toBe('Out');
    });

    it('strips InOutArgument wrapper from type', () => {
      const arg = result.arguments.find((a) => a.name === 'ioFlag');
      expect(arg).toBeDefined();
      expect(arg.type).toBe('Boolean');
      expect(arg.direction).toBe('In/Out');
    });

    it('strips wrapper and namespace prefix together', () => {
      const arg = result.arguments.find((a) => a.name === 'dataTable');
      expect(arg).toBeDefined();
      expect(arg.type).toBe('DataTable');
      expect(arg.direction).toBe('In');
    });
  });

  describe('getCategory', () => {
    it('maps known types', () => {
      expect(UiPathParser.getCategory('Sequence')).toBe('control');
      expect(UiPathParser.getCategory('Assign')).toBe('data');
      expect(UiPathParser.getCategory('If')).toBe('decision');
      expect(UiPathParser.getCategory('TryCatch')).toBe('error');
      expect(UiPathParser.getCategory('Click')).toBe('ui');
    });

    it('returns default for unknown types', () => {
      expect(UiPathParser.getCategory('SomeCustomActivity')).toBe('default');
    });
  });
});
