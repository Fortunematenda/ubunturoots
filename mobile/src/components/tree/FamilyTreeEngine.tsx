import { Fragment, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

const d3Hierarchy = require('d3-hierarchy');

type FamilyTreeNode = {
  id: string;
  name: string;
  parents?: FamilyTreeNode[];
  spouse?: FamilyTreeNode | null;
  children?: FamilyTreeNode[];
};

type FamilyTreeEngineProps = {
  data: FamilyTreeNode;
  onAddPress?: (node: FamilyTreeNode) => void;
};

type LayoutNode = {
  id: string;
  name: string;
  initials: string;
  source: FamilyTreeNode;
  x: number;
  y: number;
  parentId?: string;
  spouseId?: string;
  spouseSourceId?: string;
};

type LayoutLink = {
  from: string;
  to: string;
  type: 'parent-child' | 'spouse';
};

const CARD_WIDTH = 168;
const CARD_HEIGHT = 92;
const COUPLE_GAP = 36;
const LEVEL_HEIGHT = 170;
const TREE_PADDING_X = 40;
const TREE_PADDING_Y = 40;
const SVG_EXTRA_HEIGHT = 60;

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function buildLayout(rootNode: FamilyTreeNode) {
  const nodes = new Map<string, LayoutNode>();
  const links: LayoutLink[] = [];
  const treeLayout = d3Hierarchy.tree().nodeSize([CARD_WIDTH + COUPLE_GAP + 28, LEVEL_HEIGHT]);

  const descendantRoot = d3Hierarchy.hierarchy(rootNode, (node: FamilyTreeNode) => node.children ?? []);
  treeLayout(descendantRoot);

  const ancestorRoot = d3Hierarchy.hierarchy(rootNode, (node: FamilyTreeNode) => node.parents ?? []);
  treeLayout(ancestorRoot);

  const maxAncestorDepth = Math.max(0, ...ancestorRoot.descendants().map((node: any) => node.depth));
  const rootY = TREE_PADDING_Y + maxAncestorDepth * LEVEL_HEIGHT;

  const addNode = (source: FamilyTreeNode, x: number, y: number, parentId?: string) => {
    const existing = nodes.get(source.id);
    if (existing) {
      nodes.set(source.id, {
        ...existing,
        x,
        y,
        parentId: existing.parentId ?? parentId
      });
      return;
    }

    nodes.set(source.id, {
      id: source.id,
      name: source.name,
      initials: getInitials(source.name),
      source,
      x,
      y,
      parentId
    });
  };

  descendantRoot.each((node: any) => {
    const source = node.data as FamilyTreeNode;
    const x = node.x + TREE_PADDING_X;
    const y = rootY + node.depth * LEVEL_HEIGHT;

    addNode(source, x, y, node.parent?.data?.id);

    if (node.parent?.data?.id) {
      links.push({ from: node.parent.data.id, to: source.id, type: 'parent-child' });
    }
  });

  const ancestorShiftX = (nodes.get(rootNode.id)?.x ?? TREE_PADDING_X) - ancestorRoot.x;

  ancestorRoot.each((node: any) => {
    if (node.depth === 0) {
      return;
    }

    const source = node.data as FamilyTreeNode;
    const x = node.x + ancestorShiftX;
    const y = rootY - node.depth * LEVEL_HEIGHT;

    addNode(source, x, y, node.parent?.data?.id);

    if (node.parent?.data?.id) {
      links.push({ from: source.id, to: node.parent.data.id, type: 'parent-child' });
    }
  });

  const baseNodes = Array.from(nodes.values());

  baseNodes.forEach((node) => {
    const source = node.source;
    const spouse = source.spouse;
    if (!spouse || nodes.has(spouse.id)) {
      return;
    }

    const spouseX = node.x + CARD_WIDTH + COUPLE_GAP;
    const spouseY = node.y;

    nodes.set(spouse.id, {
      id: spouse.id,
      name: spouse.name,
      initials: getInitials(spouse.name),
      source: spouse,
      x: spouseX,
      y: spouseY,
      spouseId: source.id,
      spouseSourceId: source.id,
      parentId: node.parentId
    });

    node.spouseId = spouse.id;
    node.spouseSourceId = spouse.id;
    nodes.set(node.id, node);

    links.push({ from: source.id, to: spouse.id, type: 'spouse' });
  });

  const nodeList = Array.from(nodes.values());
  const minX = Math.min(...nodeList.map((node) => node.x));
  const minY = Math.min(...nodeList.map((node) => node.y));
  const shiftX = minX < TREE_PADDING_X ? TREE_PADDING_X - minX : 0;
  const shiftY = minY < TREE_PADDING_Y ? TREE_PADDING_Y - minY : 0;

  const shiftedNodes = nodeList.map((node) => ({
    ...node,
    x: node.x + shiftX,
    y: node.y + shiftY
  }));

  const width = Math.max(...shiftedNodes.map((node) => node.x + CARD_WIDTH)) + TREE_PADDING_X;
  const height = Math.max(...shiftedNodes.map((node) => node.y + CARD_HEIGHT)) + TREE_PADDING_Y + SVG_EXTRA_HEIGHT;

  return {
    nodes: shiftedNodes,
    nodeMap: new Map(shiftedNodes.map((node) => [node.id, node])),
    links,
    width,
    height
  };
}

export function FamilyTreeEngine({ data, onAddPress }: FamilyTreeEngineProps) {
  const layout = useMemo(() => buildLayout(data), [data]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
      <View style={[styles.canvas, { width: layout.width, height: layout.height }]}> 
        <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
          {layout.links.map((link) => {
            const fromNode = layout.nodeMap.get(link.from);
            const toNode = layout.nodeMap.get(link.to);
            if (!fromNode || !toNode) {
              return null;
            }

            if (link.type === 'spouse') {
              return (
                <Line
                  key={`${link.from}-${link.to}-spouse`}
                  x1={fromNode.x + CARD_WIDTH}
                  y1={fromNode.y + CARD_HEIGHT / 2}
                  x2={toNode.x}
                  y2={toNode.y + CARD_HEIGHT / 2}
                  stroke="#B7C2CC"
                  strokeWidth={2}
                />
              );
            }

            const parentAnchorX = fromNode.spouseId ? fromNode.x + CARD_WIDTH + COUPLE_GAP / 2 : fromNode.x + CARD_WIDTH / 2;
            const parentAnchorY = fromNode.y + CARD_HEIGHT;
            const childAnchorX = toNode.x + CARD_WIDTH / 2;
            const childAnchorY = toNode.y;
            const midY = parentAnchorY + (childAnchorY - parentAnchorY) / 2;

            return (
              <Fragment key={`${link.from}-${link.to}-child`}>
                <Line x1={parentAnchorX} y1={parentAnchorY} x2={parentAnchorX} y2={midY} stroke="#B7C2CC" strokeWidth={2} />
                <Line x1={parentAnchorX} y1={midY} x2={childAnchorX} y2={midY} stroke="#B7C2CC" strokeWidth={2} />
                <Line x1={childAnchorX} y1={midY} x2={childAnchorX} y2={childAnchorY} stroke="#B7C2CC" strokeWidth={2} />
              </Fragment>
            );
          })}
        </Svg>

        {layout.nodes.map((node) => (
          <View
            key={node.id}
            style={[
              styles.nodeWrap,
              {
                left: node.x,
                top: node.y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT
              }
            ]}
          >
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{node.initials}</Text>
              </View>
              <Text style={styles.name} numberOfLines={2}>
                {node.name}
              </Text>
              <Pressable style={styles.addButton} onPress={() => onAddPress?.(node.source)}>
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 16
  },
  canvas: {
    position: 'relative'
  },
  nodeWrap: {
    position: 'absolute'
  },
  card: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE5EA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F1ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  avatarText: {
    color: '#2C5244',
    fontWeight: '800',
    fontSize: 14
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17212B',
    textAlign: 'center'
  },
  addButton: {
    position: 'absolute',
    bottom: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DFE5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  addButtonText: {
    color: '#355E52',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20
  }
});

export type { FamilyTreeNode, FamilyTreeEngineProps };
