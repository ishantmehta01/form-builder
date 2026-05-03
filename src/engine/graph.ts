import type { Template } from '@/types/template';

export function buildConditionGraph(template: Template): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const field of template.fields) {
    if (!graph.has(field.id)) graph.set(field.id, new Set());
  }

  for (const field of template.fields) {
    for (const cond of field.conditions) {
      const targets = graph.get(cond.targetId);
      if (targets !== undefined) {
        targets.add(field.id);
      }
    }
  }

  return graph;
}

export function topologicalSort(graph: Map<string, Set<string>>, fieldIds: string[]): string[] {
  const inDegree = new Map<string, number>();
  for (const id of fieldIds) inDegree.set(id, 0);

  for (const [, dependents] of graph) {
    for (const dep of dependents) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const id of fieldIds) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    const dependents = graph.get(node) ?? new Set<string>();
    for (const dep of dependents) {
      const deg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) queue.push(dep);
    }
  }

  if (result.length !== fieldIds.length) {
    throw new Error('Cycle detected in condition dependency graph');
  }

  return result;
}

export function findCycle(graph: Map<string, Set<string>>): string[] | null {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) ?? new Set<string>()) {
      if (!visited.has(neighbor)) {
        const result = dfs(neighbor);
        if (result !== null) return result;
      } else if (stack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        return [...path.slice(cycleStart), neighbor];
      }
    }

    stack.delete(node);
    path.pop();
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle !== null) return cycle;
    }
  }

  return null;
}
