export interface TreeNode {
  label: string;
  children?: TreeNode[];
  spaceChildren?: boolean;
}

/**
 * Desenha uma árvore em texto
 */
export function renderTree(nodes: readonly TreeNode[], prefix = '', spaced = false): string[] {
  return nodes.flatMap((node, index) => {
    const isLast = index === nodes.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    const lines = [
      `${prefix}${branch}${node.label}`,
      ...renderTree(node.children ?? [], childPrefix, node.spaceChildren),
    ];

    return spaced && !isLast ? [...lines, `${prefix}│`] : lines;
  });
}
