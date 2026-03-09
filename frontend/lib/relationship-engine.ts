type RelationshipMember = {
  id: string;
  fullName: string;
  gender: string;
  fatherId: string | null;
  motherId: string | null;
  spouseId: string | null;
};

type GraphEdge = {
  to: string;
  label: string;
  type: 'parent' | 'child' | 'spouse' | 'sibling';
};

type PathStep = {
  memberId: string;
  label: string;
};

export type RelationshipResult = {
  relationship: string;
  relationship_path: string[];
  explanation: string;
  generationA: number;
  generationB: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const relationshipCache = new Map<string, { expiresAt: number; result: RelationshipResult }>();
let cacheVersion = 0;

function normalizeGender(value: string | null | undefined) {
  const v = (value || '').toLowerCase();
  if (v.startsWith('f')) return 'female';
  if (v.startsWith('m')) return 'male';
  return 'unknown';
}

function childLabel(member: RelationshipMember) {
  const gender = normalizeGender(member.gender);
  if (gender === 'male') return 'son';
  if (gender === 'female') return 'daughter';
  return 'child';
}

function parentLabel(member: RelationshipMember) {
  const gender = normalizeGender(member.gender);
  if (gender === 'male') return 'father';
  if (gender === 'female') return 'mother';
  return 'parent';
}

function siblingLabel(member: RelationshipMember) {
  const gender = normalizeGender(member.gender);
  if (gender === 'male') return 'brother';
  if (gender === 'female') return 'sister';
  return 'sibling';
}

function ordinalWord(value: number) {
  if (value === 1) return 'first';
  if (value === 2) return 'second';
  if (value === 3) return 'third';
  if (value === 4) return 'fourth';
  return `${value}th`;
}

function buildGraph(members: RelationshipMember[]) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const adjacency = new Map<string, GraphEdge[]>();
  const parentToChildren = new Map<string, string[]>();

  const pushEdge = (from: string, edge: GraphEdge) => {
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }

    const exists = adjacency.get(from)?.some((item) => item.to === edge.to && item.type === edge.type);
    if (!exists) {
      adjacency.get(from)?.push(edge);
    }
  };

  members.forEach((member) => {
    if (member.fatherId && byId.has(member.fatherId)) {
      const father = byId.get(member.fatherId)!;
      pushEdge(member.id, { to: father.id, label: parentLabel(father), type: 'parent' });
      pushEdge(father.id, { to: member.id, label: childLabel(member), type: 'child' });
      parentToChildren.set(father.id, [...(parentToChildren.get(father.id) || []), member.id]);
    }

    if (member.motherId && byId.has(member.motherId)) {
      const mother = byId.get(member.motherId)!;
      pushEdge(member.id, { to: mother.id, label: parentLabel(mother), type: 'parent' });
      pushEdge(mother.id, { to: member.id, label: childLabel(member), type: 'child' });
      parentToChildren.set(mother.id, [...(parentToChildren.get(mother.id) || []), member.id]);
    }

    if (member.spouseId && byId.has(member.spouseId)) {
      pushEdge(member.id, { to: member.spouseId, label: 'spouse', type: 'spouse' });
      pushEdge(member.spouseId, { to: member.id, label: 'spouse', type: 'spouse' });
    }
  });

  parentToChildren.forEach((children) => {
    for (let i = 0; i < children.length; i += 1) {
      for (let j = i + 1; j < children.length; j += 1) {
        const first = byId.get(children[i]);
        const second = byId.get(children[j]);
        if (!first || !second) continue;
        pushEdge(first.id, { to: second.id, label: siblingLabel(second), type: 'sibling' });
        pushEdge(second.id, { to: first.id, label: siblingLabel(first), type: 'sibling' });
      }
    }
  });

  return { byId, adjacency };
}

function bfsPath(adjacency: Map<string, GraphEdge[]>, fromId: string, toId: string) {
  if (fromId === toId) {
    return [] as PathStep[];
  }

  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  const prev = new Map<string, { from: string; label: string }>();

  while (queue.length) {
    const current = queue.shift()!;
    const edges = adjacency.get(current) || [];

    for (const edge of edges) {
      if (visited.has(edge.to)) {
        continue;
      }

      visited.add(edge.to);
      prev.set(edge.to, { from: current, label: edge.label });
      if (edge.to === toId) {
        queue.length = 0;
        break;
      }
      queue.push(edge.to);
    }
  }

  if (!prev.has(toId)) {
    return null;
  }

  const path: PathStep[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = prev.get(cursor);
    if (!step) {
      return null;
    }
    path.push({ memberId: cursor, label: step.label });
    cursor = step.from;
  }

  return path.reverse();
}

function buildGenerationMap(members: RelationshipMember[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const cache = new Map<string, number>();
  const stack = new Set<string>();

  const generationOf = (id: string): number => {
    if (cache.has(id)) {
      return cache.get(id)!;
    }

    if (stack.has(id)) {
      return 1;
    }

    const member = byId.get(id);
    if (!member) {
      return 1;
    }

    stack.add(id);
    const parents = [member.fatherId, member.motherId].filter(Boolean) as string[];
    const generation = parents.length ? Math.max(...parents.map((parentId) => generationOf(parentId))) + 1 : 1;
    stack.delete(id);

    cache.set(id, generation);
    return generation;
  };

  members.forEach((member) => {
    generationOf(member.id);
  });

  return cache;
}

function ancestorDistanceMap(memberId: string, membersById: Map<string, RelationshipMember>, maxDepth = 8) {
  const distances = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: memberId, depth: 0 }];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth > maxDepth) {
      continue;
    }

    const member = membersById.get(current.id);
    if (!member) {
      continue;
    }

    const parents = [member.fatherId, member.motherId].filter(Boolean) as string[];
    for (const parentId of parents) {
      const parentDepth = current.depth + 1;
      if (distances.has(parentId) && (distances.get(parentId) || 99) <= parentDepth) {
        continue;
      }
      distances.set(parentId, parentDepth);
      queue.push({ id: parentId, depth: parentDepth });
    }
  }

  return distances;
}

function cousinRelationship(memberA: RelationshipMember, memberB: RelationshipMember, membersById: Map<string, RelationshipMember>) {
  const ancestorsA = ancestorDistanceMap(memberA.id, membersById);
  const ancestorsB = ancestorDistanceMap(memberB.id, membersById);

  let best: { ancestorId: string; distanceA: number; distanceB: number } | null = null;

  for (const [ancestorId, distanceA] of ancestorsA.entries()) {
    const distanceB = ancestorsB.get(ancestorId);
    if (!distanceB) {
      continue;
    }

    if (!best) {
      best = { ancestorId, distanceA, distanceB };
      continue;
    }

    const bestScore = Math.max(best.distanceA, best.distanceB) * 10 + best.distanceA + best.distanceB;
    const score = Math.max(distanceA, distanceB) * 10 + distanceA + distanceB;
    if (score < bestScore) {
      best = { ancestorId, distanceA, distanceB };
    }
  }

  if (!best || best.distanceA <= 1 || best.distanceB <= 1) {
    return null;
  }

  const cousinDegree = Math.min(best.distanceA, best.distanceB) - 1;
  const removed = Math.abs(best.distanceA - best.distanceB);
  let relationship = cousinDegree === 1 ? 'cousin' : `${ordinalWord(cousinDegree)} cousin`;
  if (removed > 0) {
    relationship = `${relationship} ${removed} time${removed > 1 ? 's' : ''} removed`;
  }

  const ancestorName = membersById.get(best.ancestorId)?.fullName || 'a shared ancestor';
  return {
    relationship,
    explanation: `You share ${ancestorName} as a common ancestor.`
  };
}

function inferRelationship(path: PathStep[], memberA: RelationshipMember, memberB: RelationshipMember, membersById: Map<string, RelationshipMember>) {
  if (!path.length) {
    return {
      relationship: 'self',
      explanation: 'This is the same person.'
    };
  }

  const labels = path.map((step) => step.label.toLowerCase());
  const joined = labels.join('>');
  const isParentStep = (label: string) => ['father', 'mother', 'parent'].includes(label);
  const isChildStep = (label: string) => ['son', 'daughter', 'child'].includes(label);
  const isSiblingStep = (label: string) => ['brother', 'sister', 'sibling'].includes(label);

  if (joined === 'father' || joined === 'mother' || joined === 'parent') {
    return { relationship: labels[0], explanation: `${memberB.fullName} is your ${labels[0]}.` };
  }
  if (isChildStep(joined)) {
    return { relationship: joined, explanation: `${memberB.fullName} is your ${joined}.` };
  }
  if (joined === 'spouse') {
    return { relationship: 'spouse', explanation: `${memberB.fullName} is your spouse.` };
  }
  if (isSiblingStep(joined)) {
    return { relationship: joined, explanation: `${memberB.fullName} is your ${joined}.` };
  }

  if (labels.length === 2 && isParentStep(labels[0]) && isParentStep(labels[1])) {
    return { relationship: 'grandparent', explanation: `${memberB.fullName} is your grandparent.` };
  }

  if (labels.length === 2 && isChildStep(labels[0]) && isChildStep(labels[1])) {
    return { relationship: 'grandchild', explanation: `${memberB.fullName} is your grandchild.` };
  }

  if (labels.length === 2 && isParentStep(labels[0]) && isSiblingStep(labels[1])) {
    return {
      relationship: normalizeGender(memberB.gender) === 'male' ? 'uncle' : normalizeGender(memberB.gender) === 'female' ? 'aunt' : 'uncle/aunt',
      explanation: `${memberB.fullName} is a sibling of your parent.`
    };
  }

  if (labels.length === 2 && isSiblingStep(labels[0]) && isChildStep(labels[1])) {
    return {
      relationship: normalizeGender(memberB.gender) === 'male' ? 'nephew' : normalizeGender(memberB.gender) === 'female' ? 'niece' : 'niece/nephew',
      explanation: `${memberB.fullName} is the child of your sibling.`
    };
  }

  const cousin = cousinRelationship(memberA, memberB, membersById);
  if (cousin) {
    return cousin;
  }

  return {
    relationship: 'relative',
    explanation: `Relationship found through: ${labels.join(' -> ')}`
  };
}

function cacheKey(personAId: string, personBId: string) {
  return `${cacheVersion}:${personAId}->${personBId}`;
}

export function clearRelationshipCache() {
  relationshipCache.clear();
  cacheVersion += 1;
}

export function findRelationship(members: RelationshipMember[], personAId: string, personBId: string): RelationshipResult | null {
  const key = cacheKey(personAId, personBId);
  const cached = relationshipCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const { byId, adjacency } = buildGraph(members);
  const personA = byId.get(personAId);
  const personB = byId.get(personBId);
  if (!personA || !personB) {
    return null;
  }

  const path = bfsPath(adjacency, personAId, personBId);
  if (!path) {
    return null;
  }

  const generationMap = buildGenerationMap(members);
  const inferred = inferRelationship(path, personA, personB, byId);
  const result: RelationshipResult = {
    relationship: inferred.relationship,
    relationship_path: path.map((step) => step.label),
    explanation: inferred.explanation,
    generationA: generationMap.get(personAId) || 1,
    generationB: generationMap.get(personBId) || 1
  };

  relationshipCache.set(key, {
    result,
    expiresAt: now + CACHE_TTL_MS
  });

  return result;
}

export function buildGenerationLabels(members: RelationshipMember[]) {
  const map = buildGenerationMap(members);
  return Array.from(map.entries()).map(([memberId, generation]) => ({ memberId, generation }));
}
