import { describe, it, expect } from 'vitest';

function resolveWorkflowPath(workflowFileName, currentDir) {
  const normalized = workflowFileName.replace(/\\/g, '/');
  const segments = currentDir.split('/').filter(Boolean);
  const parts = normalized.split('/');

  for (const part of parts) {
    if (part === '..') {
      segments.pop();
    } else if (part !== '.') {
      segments.push(part);
    }
  }
  return segments.join('/');
}

describe('resolveWorkflowPath', () => {
  it('resolves simple relative path', () => {
    expect(resolveWorkflowPath('Child.xaml', 'Processes'))
      .toBe('Processes/Child.xaml');
  });

  it('resolves parent directory traversal', () => {
    expect(resolveWorkflowPath('..\\Shared\\Helper.xaml', 'Processes/Main'))
      .toBe('Processes/Shared/Helper.xaml');
  });

  it('resolves subfolder path', () => {
    expect(resolveWorkflowPath('Sub/Child.xaml', 'Processes'))
      .toBe('Processes/Sub/Child.xaml');
  });

  it('handles backslash separators', () => {
    expect(resolveWorkflowPath('Sub\\Child.xaml', 'Processes'))
      .toBe('Processes/Sub/Child.xaml');
  });

  it('handles multiple parent traversals', () => {
    expect(resolveWorkflowPath('../../Root.xaml', 'A/B/C'))
      .toBe('A/Root.xaml');
  });

  it('handles empty currentDir', () => {
    expect(resolveWorkflowPath('Child.xaml', ''))
      .toBe('Child.xaml');
  });
});
