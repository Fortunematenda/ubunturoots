type TreeNode = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  gender?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
  spouseId?: string | null;
  birthYear?: number | null;
  status: 'ACTIVE' | 'DECEASED';
};

export type PositionedNode = TreeNode & {
  generation: number;
  x: number;
  y: number;
  children: string[];
};

export type TreeEdge = {
  source: string;
  target: string;
  type: 'parent_child' | 'spouse';
};

export function buildFamilyTree(nodes: TreeNode[]) {
  const nodeMap = new Map<string, PositionedNode>();
  const spousePairs = new Set<string>();

  nodes.forEach((node) => {
    nodeMap.set(node.id, {
      ...node,
      generation: 0,
      x: 0,
      y: 0,
      children: []
    });
  });

  nodeMap.forEach((node) => {
    if (node.fatherId && nodeMap.has(node.fatherId)) {
      nodeMap.get(node.fatherId)?.children.push(node.id);
    }
    if (node.motherId && nodeMap.has(node.motherId)) {
      nodeMap.get(node.motherId)?.children.push(node.id);
    }
  });

  const generationMemo = new Map<string, number>();
  const visiting = new Set<string>();

  const getGeneration = (node: PositionedNode): number => {
    if (generationMemo.has(node.id)) {
      return generationMemo.get(node.id) ?? 0;
    }

    if (visiting.has(node.id)) {
      return 0;
    }

    visiting.add(node.id);

    const parentIds = [node.fatherId, node.motherId].filter((id): id is string => Boolean(id));
    let highestParentGeneration = -1;

    parentIds.forEach((parentId) => {
      const parent = nodeMap.get(parentId);
      if (!parent) {
        return;
      }
      highestParentGeneration = Math.max(highestParentGeneration, getGeneration(parent));
    });

    visiting.delete(node.id);

    const generation = highestParentGeneration + 1;
    generationMemo.set(node.id, generation);
    return generation;
  };

  nodeMap.forEach((node) => {
    node.generation = getGeneration(node);
  });

  for (let i = 0; i < nodeMap.size; i += 1) {
    let changed = false;

    nodeMap.forEach((node) => {
      if (!node.spouseId) {
        return;
      }

      const spouse = nodeMap.get(node.spouseId);
      if (!spouse) {
        return;
      }

      const alignedGeneration = Math.min(node.generation, spouse.generation);
      if (node.generation !== alignedGeneration || spouse.generation !== alignedGeneration) {
        node.generation = alignedGeneration;
        spouse.generation = alignedGeneration;
        changed = true;
      }
    });

    if (!changed) {
      break;
    }
  }

  const generationGroups = new Map<number, PositionedNode[]>();
  nodeMap.forEach((node) => {
    if (!generationGroups.has(node.generation)) {
      generationGroups.set(node.generation, []);
    }
    generationGroups.get(node.generation)?.push(node);
  });

  const generationOrder = Array.from(generationGroups.keys()).sort((a, b) => a - b);
  const rowOrderByGeneration = new Map<number, PositionedNode[]>();

  generationOrder.forEach((generation) => {
    const group = [...(generationGroups.get(generation) ?? [])];
    group.sort((a, b) => a.fullName.localeCompare(b.fullName));

    const consumed = new Set<string>();
    const ordered: PositionedNode[] = [];

    group.forEach((node) => {
      if (consumed.has(node.id)) {
        return;
      }

      ordered.push(node);
      consumed.add(node.id);

      if (!node.spouseId) {
        return;
      }

      const spouse = group.find((candidate) => candidate.id === node.spouseId && !consumed.has(candidate.id));
      if (spouse) {
        ordered.push(spouse);
        consumed.add(spouse.id);
      }
    });

    rowOrderByGeneration.set(generation, ordered);
  });

  const maxRowSize = Math.max(1, ...Array.from(rowOrderByGeneration.values()).map((row) => row.length));
  const horizontalSpacing = 152;
  const verticalSpacing = 118;
  const paddingX = 98;
  const paddingY = 78;

  generationOrder.forEach((generation) => {
    const row = rowOrderByGeneration.get(generation) ?? [];
    const leftOffset = ((maxRowSize - row.length) * horizontalSpacing) / 2;

    row.forEach((node, index) => {
      node.x = paddingX + leftOffset + index * horizontalSpacing;
      node.y = paddingY + generation * verticalSpacing;
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links: [
      ...Array.from(nodeMap.values()).flatMap<TreeEdge>((node) =>
        node.children.map((childId) => ({
          source: node.id,
          target: childId,
          type: 'parent_child'
        }))
      ),
      ...Array.from(nodeMap.values()).flatMap<TreeEdge>((node) => {
        if (!node.spouseId || !nodeMap.has(node.spouseId)) {
          return [];
        }

        const pairKey = [node.id, node.spouseId].sort().join('::');
        if (spousePairs.has(pairKey)) {
          return [];
        }

        spousePairs.add(pairKey);
        return [
          {
            source: node.id,
            target: node.spouseId,
            type: 'spouse'
          }
        ];
      })
    ]
  };
}
