export interface TreeNode {
  label: string;
  children?: TreeNode[];
}

/**
 * Desenha uma árvore em texto
 */
export function renderTree(nodes: readonly TreeNode[], prefix = ''): string[] {
  return nodes.flatMap((node, index) => {
    const isLast = index === nodes.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    return [`${prefix}${branch}${node.label}`, ...renderTree(node.children ?? [], childPrefix)];
  });
}
