"use client";

import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';

type TreeNode = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  gender?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
  spouseId?: string | null;
  placeholderKind?: 'father' | 'mother' | null;
  placeholderForId?: string | null;
  status: 'ACTIVE' | 'DECEASED';
  birthYear?: number | null;
  generation: number;
  x: number;
  y: number;
};

type TreeLink = {
  source: string;
  target: string;
  type?: 'parent_child' | 'spouse';
};

type FamilyTreeCanvasProps = {
  data: {
    nodes: TreeNode[];
    links: TreeLink[];
  };
  selectedNodeId?: string | null;
  onSelectNode?: (node: TreeNode) => void;
  onAddRelative?: (node: TreeNode) => void;
  onAddSpecificRelative?: (node: TreeNode, relativeType: 'father' | 'mother') => void;
};

export function FamilyTreeCanvas({ data, selectedNodeId, onSelectNode, onAddRelative, onAddSpecificRelative }: FamilyTreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const getCardBorderColor = useCallback(
    (node: TreeNode) => {
      if (node.id === selectedNodeId) return '#34A853';
      if (node.gender === 'FEMALE') return '#F7A3A1';
      if (node.gender === 'MALE') return '#69C4E8';
      return '#CBD5E1';
    },
    [selectedNodeId]
  );

  const getAvatarRingColor = useCallback(
    (node: TreeNode) => {
      if (node.id === selectedNodeId) return '#34A853';
      if (node.gender === 'FEMALE') return '#FDB5B3';
      if (node.gender === 'MALE') return '#8FD7F4';
      return '#D4DCE5';
    },
    [selectedNodeId]
  );

  const getNameLines = (name: string) => {
    const words = name
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length <= 2) {
      return [words.join(' '), ''];
    }

    return [words.slice(0, 2).join(' '), words.slice(2, 4).join(' ')];
  };

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isSmallMobile = window.matchMedia('(max-width: 480px)').matches;
    const cardWidth = isSmallMobile ? 98 : isMobile ? 112 : 128;
    const cardHeight = isSmallMobile ? 34 : isMobile ? 38 : 42;
    const placeholderSize = isSmallMobile ? 56 : isMobile ? 62 : 68;
    const avatarRadius = isSmallMobile ? 8 : isMobile ? 9 : 10;
    const nameFontSize = isSmallMobile ? 7.2 : 8.4;
    const nameLineGap = isSmallMobile ? 7.6 : 9;
    const chipRadius = isSmallMobile ? 3.6 : 4.2;
    const nameStartX = -cardWidth / 2 + 36;
    const nameRightPadding = isSmallMobile ? 20 : 22;
    const maxNameWidth = cardWidth - (nameStartX + cardWidth / 2) - nameRightPadding;
    const approxCharWidth = isSmallMobile ? 5.4 : 6.2;
    const maxNameCharsPerLine = Math.max(8, Math.floor(maxNameWidth / approxCharWidth));

    const truncateLine = (line: string) => {
      if (!line) {
        return '';
      }
      if (line.length <= maxNameCharsPerLine) {
        return line;
      }
      return `${line.slice(0, Math.max(1, maxNameCharsPerLine - 1))}…`;
    };
    const generationToY = new Map<number, number>();
    data.nodes.forEach((node) => {
      if (generationToY.has(node.generation)) {
        return;
      }
      generationToY.set(node.generation, node.y);
    });
    const generationYs = Array.from(generationToY.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, y]) => y);
    const generationGaps = generationYs
      .slice(1)
      .map((y, idx) => y - generationYs[idx])
      .filter((gap) => gap > 0);
    const generationGap = generationGaps.length ? Math.min(...generationGaps) : (isMobile ? 96 : 118);

    const placeholderNodes: TreeNode[] = [];
    const placeholderIndex = new Map<string, { fatherId?: string; motherId?: string }>();
    const placeholderOffsetX = placeholderSize * 0.82;

    data.nodes.forEach((node) => {
      if (!node.fatherId) {
        const placeholderId = `placeholder:father:${node.id}`;
        placeholderNodes.push({
          id: placeholderId,
          fullName: 'Add father',
          photoUrl: null,
          gender: null,
          fatherId: null,
          motherId: null,
          spouseId: null,
          placeholderKind: 'father',
          placeholderForId: node.id,
          status: 'ACTIVE',
          birthYear: null,
          generation: Math.max(0, node.generation - 1),
          x: node.x - placeholderOffsetX,
          y: node.y - generationGap
        });
        const entry = placeholderIndex.get(node.id) ?? {};
        entry.fatherId = placeholderId;
        placeholderIndex.set(node.id, entry);
      }

      if (!node.motherId) {
        const placeholderId = `placeholder:mother:${node.id}`;
        placeholderNodes.push({
          id: placeholderId,
          fullName: 'Add mother',
          photoUrl: null,
          gender: null,
          fatherId: null,
          motherId: null,
          spouseId: null,
          placeholderKind: 'mother',
          placeholderForId: node.id,
          status: 'ACTIVE',
          birthYear: null,
          generation: Math.max(0, node.generation - 1),
          x: node.x + placeholderOffsetX,
          y: node.y - generationGap
        });
        const entry = placeholderIndex.get(node.id) ?? {};
        entry.motherId = placeholderId;
        placeholderIndex.set(node.id, entry);
      }
    });

    const nodesToRender = [...data.nodes, ...placeholderNodes];
    const nodeById = new Map(nodesToRender.map((node) => [node.id, node]));
    const xCoords = nodesToRender.map((node) => node.x);
    const yCoords = nodesToRender.map((node) => node.y);
    const minX = Math.min(...xCoords, 0) - cardWidth;
    const maxX = Math.max(...xCoords, 0) + cardWidth;
    const minY = Math.min(...yCoords, 0) - cardHeight * 1.8;
    const maxY = Math.max(...yCoords, 0) + cardHeight * 2.2;
    const width = Math.max(isMobile ? 480 : 980, maxX - minX);
    const height = Math.max(isMobile ? 360 : 620, maxY - minY);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const root = svg.append('g');
    const defs = svg.append('defs');

    defs
      .append('linearGradient')
      .attr('id', 'tree-canvas-bg-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')
      .selectAll('stop')
      .data([
        { offset: '0%', color: '#F8FAFC' },
        { offset: '100%', color: '#EEF2F7' }
      ])
      .enter()
      .append('stop')
      .attr('offset', (d) => d.offset)
      .attr('stop-color', (d) => d.color);

    const cardShadow = defs.append('filter').attr('id', 'tree-card-shadow').attr('x', '-20%').attr('y', '-30%').attr('width', '140%').attr('height', '180%');
    cardShadow.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 2).attr('flood-color', '#0F172A').attr('flood-opacity', 0.12);

    const selectedShadow = defs.append('filter').attr('id', 'tree-card-selected-shadow').attr('x', '-35%').attr('y', '-45%').attr('width', '170%').attr('height', '210%');
    selectedShadow.append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 3).attr('flood-color', '#16A34A').attr('flood-opacity', 0.28);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(isMobile ? [0.35, 3] : [0.5, 2.5])
      .on('zoom', (event) => {
        root.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);

    root
      .append('rect')
      .attr('x', minX)
      .attr('y', minY)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#tree-canvas-bg-gradient)');

    const linkLayer = root.append('g').attr('class', 'links');
    linkLayer
      .selectAll('path')
      .data(() => {
        const spousePairs = new Set<string>();
        const spouseLinks: TreeLink[] = [];

        data.nodes.forEach((node) => {
          if (!node.spouseId) {
            return;
          }
          const spouse = nodeById.get(node.spouseId);
          if (!spouse) {
            return;
          }

          const pairKey = [node.id, spouse.id].sort().join('::');
          if (spousePairs.has(pairKey)) {
            return;
          }
          spousePairs.add(pairKey);
          spouseLinks.push({ source: node.id, target: spouse.id, type: 'spouse' });
        });

        type ParentUnit = {
          key: string;
          parentIds: string[];
          childIds: Set<string>;
        };

        const units = new Map<string, ParentUnit>();

        data.nodes.forEach((child) => {
          const parentIds = [child.fatherId, child.motherId].filter((id): id is string => Boolean(id));
          if (!parentIds.length) {
            return;
          }

          const resolvedParents = parentIds.map((id) => nodeById.get(id)).filter((node): node is TreeNode => Boolean(node));
          if (!resolvedParents.length) {
            return;
          }

          if (resolvedParents.length === 1) {
            const parent = resolvedParents[0];
            const spouse = parent.spouseId ? nodeById.get(parent.spouseId) : undefined;
            if (spouse) {
              const coupleParents = [parent.id, spouse.id].sort();
              const unitKey = coupleParents.join('::');
              const unit = units.get(unitKey) ?? { key: unitKey, parentIds: coupleParents, childIds: new Set<string>() };
              unit.childIds.add(child.id);
              units.set(unitKey, unit);
              return;
            }

            const unitKey = parent.id;
            const unit = units.get(unitKey) ?? { key: unitKey, parentIds: [parent.id], childIds: new Set<string>() };
            unit.childIds.add(child.id);
            units.set(unitKey, unit);
            return;
          }

          const [a, b] = resolvedParents;
          const areSpouses = a.spouseId === b.id || b.spouseId === a.id;
          if (areSpouses) {
            const coupleParents = [a.id, b.id].sort();
            const unitKey = coupleParents.join('::');
            const unit = units.get(unitKey) ?? { key: unitKey, parentIds: coupleParents, childIds: new Set<string>() };
            unit.childIds.add(child.id);
            units.set(unitKey, unit);
            return;
          }

          [a, b].forEach((parent) => {
            const unitKey = parent.id;
            const unit = units.get(unitKey) ?? { key: unitKey, parentIds: [parent.id], childIds: new Set<string>() };
            unit.childIds.add(child.id);
            units.set(unitKey, unit);
          });
        });

        const parentConnectorLinks: TreeLink[] = [];
        units.forEach((unit) => {
          const childIds = Array.from(unit.childIds);
          if (!childIds.length) {
            return;
          }

          parentConnectorLinks.push({
            source: unit.parentIds.join(','),
            target: childIds.join(','),
            type: 'parent_child'
          });
        });

        return [...spouseLinks, ...parentConnectorLinks];
      })
      .enter()
      .append('path')
      .attr('d', (link) => {
        if (link.type === 'spouse') {
          const source = nodeById.get(link.source);
          if (!source) {
            return '';
          }
          const target = nodeById.get(link.target);
          if (!target) {
            return '';
          }
          const direction = source.x < target.x ? 1 : -1;
          const startX = source.x + direction * (cardWidth / 2 + 2);
          const endX = target.x - direction * (cardWidth / 2 + 2);
          return `M ${startX} ${source.y} H ${endX}`;
        }

        const parentIds = link.source.split(',');
        const parents = parentIds.map((id) => nodeById.get(id)).filter((node): node is TreeNode => Boolean(node));
        if (!parents.length) {
          return '';
        }

        const childIds = link.target.split(',');
        const children = childIds.map((id) => nodeById.get(id)).filter((node): node is TreeNode => Boolean(node));
        if (!children.length) {
          return '';
        }

        const notchHeight = isSmallMobile ? 11 : 13;
        const parentExitPadding = notchHeight + 4;
        const parentY = Math.max(...parents.map((parent) => parent.y + cardHeight / 2 + parentExitPadding));
        const parentsSortedByX = [...parents].sort((a, b) => a.x - b.x);
        const anchorX = parentsSortedByX.length === 2 ? (parentsSortedByX[0].x + parentsSortedByX[1].x) / 2 : parentsSortedByX[0].x;
        const childTopY = Math.min(...children.map((child) => child.y - cardHeight / 2 - 3));
        const junctionY = parentY + (childTopY - parentY) / 2;

        const childXs = children.map((child) => child.x);
        const minChildX = Math.min(...childXs);
        const maxChildX = Math.max(...childXs);

        const segments: string[] = [];

        if (parentsSortedByX.length === 2) {
          const coupleMidY = parentsSortedByX[0].y;
          const leftX = parentsSortedByX[0].x;
          const rightX = parentsSortedByX[1].x;

          segments.push(`M ${anchorX} ${coupleMidY} V ${parentY}`);
          segments.push(`M ${leftX} ${parentY} H ${rightX}`);
        }

        segments.push(`M ${anchorX} ${parentY} V ${junctionY}`);

        const childrenSortedByX = [...children].sort((a, b) => a.x - b.x);

        if (childrenSortedByX.length === 1) {
          const child = childrenSortedByX[0];
          const childY = child.y - cardHeight / 2 - 3;
          segments.push(`M ${anchorX} ${junctionY} H ${child.x} V ${childY}`);
          return segments.join(' ');
        }

        segments.push(`M ${minChildX} ${junctionY} H ${maxChildX}`);
        childrenSortedByX.forEach((child) => {
          const childY = child.y - cardHeight / 2 - 3;
          segments.push(`M ${child.x} ${junctionY} V ${childY}`);
        });
        return segments.join(' ');
      })
      .attr('fill', 'none')
      .attr('stroke', (link) => (link.type === 'spouse' ? '#E3A7A7' : '#C5CCD6'))
      .attr('stroke-width', (link) => (link.type === 'spouse' ? (isSmallMobile ? 1.3 : 1.5) : isSmallMobile ? 1.1 : 1.25))
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('opacity', (link) => (link.type === 'spouse' ? 0.95 : 0.82));

    const placeholderPathData: Array<{ key: string; d: string }> = [];
    placeholderIndex.forEach((entry, childId) => {
      const child = nodeById.get(childId);
      if (!child) {
        return;
      }

      const childTopY = child.y - cardHeight / 2 - 3;
      const father = entry.fatherId ? nodeById.get(entry.fatherId) : undefined;
      const mother = entry.motherId ? nodeById.get(entry.motherId) : undefined;

      if (father && mother) {
        const isFatherLeft = father.x <= mother.x;
        const leftParent = isFatherLeft ? father : mother;
        const rightParent = isFatherLeft ? mother : father;

        const connectY = (leftParent.y + rightParent.y) / 2;
        const joinInset = 10;
        const leftEdgeX = leftParent.x + placeholderSize / 2 - joinInset;
        const rightEdgeX = rightParent.x - placeholderSize / 2 + joinInset;
        const midX = (leftEdgeX + rightEdgeX) / 2;

        placeholderPathData.push({
          key: `${childId}:parents`,
          d: `M ${leftEdgeX} ${connectY} H ${rightEdgeX} M ${midX} ${connectY} V ${childTopY}`
        });
        return;
      }

      const single = father ?? mother;
      if (!single) {
        return;
      }
      const startY = single.y + placeholderSize / 2 + 2;
      placeholderPathData.push({ key: `${childId}:single`, d: `M ${single.x} ${startY} V ${childTopY}` });
    });

    root
      .select('g.links')
      .selectAll('path.placeholder')
      .data(placeholderPathData, (datum) => (datum as { key: string }).key)
      .enter()
      .append('path')
      .attr('class', 'placeholder')
      .attr('d', (datum) => datum.d)
      .attr('fill', 'none')
      .attr('stroke', '#C5CCD6')
      .attr('stroke-width', isSmallMobile ? 1.05 : 1.2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('opacity', 0.82);

    const group = root
      .selectAll('g.node')
      .data(nodesToRender)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (node) => `translate(${node.x},${node.y})`);

    group
      .filter((node) => !node.placeholderKind)
      .each((node) => {
        defs
          .append('clipPath')
          .attr('id', `member-photo-clip-${node.id}`)
          .append('circle')
          .attr('r', avatarRadius)
          .attr('cx', -cardWidth / 2 + 16)
          .attr('cy', 0);

        defs
          .append('clipPath')
          .attr('id', `member-name-clip-${node.id}`)
          .append('rect')
          .attr('x', nameStartX)
          .attr('y', -cardHeight / 2)
          .attr('width', maxNameWidth)
          .attr('height', cardHeight);
      });

    group
      .filter((node) => Boolean(node.placeholderKind))
      .append('rect')
      .attr('x', -placeholderSize / 2)
      .attr('y', -placeholderSize / 2)
      .attr('width', placeholderSize)
      .attr('height', placeholderSize)
      .attr('rx', 12)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#B8C3D0')
      .attr('stroke-width', 1.15)
      .attr('stroke-dasharray', '6 5')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('opacity', 0.95);

    group
      .filter((node) => Boolean(node.placeholderKind))
      .append('text')
      .attr('x', 0)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748B')
      .attr('font-size', isSmallMobile ? 15 : 16)
      .attr('font-weight', 900)
      .text('+');

    group
      .filter((node) => Boolean(node.placeholderKind))
      .append('text')
      .attr('x', 0)
      .attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748B')
      .attr('font-size', isSmallMobile ? 9.6 : 10.2)
      .attr('font-weight', 800)
      .text((node) => node.fullName);

    group
      .filter((node) => !node.placeholderKind)
      .append('rect')
      .attr('x', -cardWidth / 2)
      .attr('y', -cardHeight / 2)
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 6)
      .attr('fill', '#FFFFFF')
      .attr('stroke', (node) => getCardBorderColor(node))
      .attr('stroke-width', (node) => (node.id === selectedNodeId ? 2.2 : 1.4))
      .attr('filter', (node) =>
        node.id === selectedNodeId ? 'url(#tree-card-selected-shadow)' : 'url(#tree-card-shadow)'
      )
      .attr('opacity', 1);

    group
      .filter((node) => !node.placeholderKind)
      .append('path')
      .attr('d', () => {
        const topY = cardHeight / 2 - 0.5;
        const notchHalfWidth = Math.max(16, Math.min(22, cardWidth * 0.18));
        const notchHeight = isSmallMobile ? 11 : 13;
        const bottomY = topY + notchHeight;
        const curve = isSmallMobile ? 7 : 8;

        return [
          `M ${-notchHalfWidth} ${topY}`,
          `H ${notchHalfWidth}`,
          `Q ${notchHalfWidth + curve} ${(topY + bottomY) / 2} ${notchHalfWidth} ${bottomY}`,
          `H ${-notchHalfWidth}`,
          `Q ${-notchHalfWidth - curve} ${(topY + bottomY) / 2} ${-notchHalfWidth} ${topY}`,
          'Z'
        ].join(' ');
      })
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#D6DEE8')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#tree-card-shadow)');

    group
      .filter((node) => !node.placeholderKind)
      .append('circle')
      .attr('cx', -cardWidth / 2 + 16)
      .attr('cy', 0)
      .attr('r', avatarRadius + 1.5)
      .attr('fill', '#F8FAFC')
      .attr('stroke', (node) => getAvatarRingColor(node))
      .attr('stroke-width', 1);

    const cameraChipRadius = isSmallMobile ? 7.4 : isMobile ? 8 : 8.4;
    const cameraChipCx = -cardWidth / 2 + 27;
    const cameraChipCy = 12;

    group
      .filter((node) => !node.placeholderKind)
      .append('circle')
      .attr('cx', cameraChipCx)
      .attr('cy', cameraChipCy)
      .attr('r', cameraChipRadius)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#D6DEE8')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#tree-card-shadow)');

    group
      .filter((node) => !node.placeholderKind)
      .append('path')
      .attr('d', () => {
        const s = cameraChipRadius * 0.92;
        const x = cameraChipCx;
        const y = cameraChipCy;

        // Simple pencil: body (diagonal) + tip line.
        return [
          `M ${x - s * 0.6} ${y + s * 0.25}`,
          `L ${x + s * 0.15} ${y - s * 0.5}`,
          `L ${x + s * 0.55} ${y - s * 0.1}`,
          `L ${x - s * 0.2} ${y + s * 0.65}`,
          'Z',
          `M ${x - s * 0.65} ${y + s * 0.75}`,
          `L ${x - s * 0.25} ${y + s * 0.35}`
        ].join(' ');
      })
      .attr('fill', 'none')
      .attr('stroke', '#111827')
      .attr('stroke-width', 1.2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    group
      .filter((node) => !node.placeholderKind && Boolean(node.photoUrl))
      .append('image')
      .attr('x', -cardWidth / 2 + 6)
      .attr('y', -10)
      .attr('width', 20)
      .attr('height', 20)
      .attr('clip-path', (node) => `url(#member-photo-clip-${node.id})`)
      .attr('href', (node) => node.photoUrl || '');

    group
      .filter((node) => !node.placeholderKind && !node.photoUrl)
      .append('text')
      .text((node) =>
        node.fullName
          .split(' ')
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
      )
      .attr('x', -cardWidth / 2 + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748B')
      .attr('dy', 4)
      .attr('font-size', isSmallMobile ? 7 : 8)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.02em');

    const nameGroup = group
      .filter((node) => !node.placeholderKind)
      .append('g')
      .attr('clip-path', (node) => `url(#member-name-clip-${node.id})`);

    nameGroup
      .append('text')
      .attr('x', nameStartX)
      .attr('y', -2)
      .attr('fill', '#0F172A')
      .attr('font-size', nameFontSize)
      .attr('font-weight', 700)
      .attr('text-anchor', 'start')
      .attr('letter-spacing', '0.015em')
      .selectAll('tspan')
      .data((node) => getNameLines(node.fullName).map(truncateLine))
      .enter()
      .append('tspan')
      .attr('x', nameStartX)
      .attr('dy', (_, index) => (index === 0 ? 0 : nameLineGap))
      .text((line) => line)
      .attr('fill-opacity', (line) => (line ? 1 : 0));

    const addAction = group
      .filter((node) => !node.placeholderKind)
      .append('circle')
      .attr('cx', 0)
      .attr('cy', cardHeight / 2 + (isSmallMobile ? 7.2 : 8.6))
      .attr('r', chipRadius + (isSmallMobile ? 0.55 : 0.95))
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#D6DEE8')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#tree-card-shadow)');

    group
      .filter((node) => !node.placeholderKind)
      .append('text')
      .attr('x', 0)
      .attr('y', cardHeight / 2 + (isSmallMobile ? 9.4 : 10.8))
      .attr('text-anchor', 'middle')
      .attr('fill', '#1F5F46')
      .attr('font-size', isSmallMobile ? 9 : 10)
      .attr('font-weight', 800)
      .attr('pointer-events', 'none')
      .text('+');

    const editIconX = cardWidth / 2 - 12;
    const editIconY = cardHeight / 2 - 10;
    group
      .filter((node) => !node.placeholderKind)
      .append('path')
      .attr('d', () => {
        const s = isSmallMobile ? 6.8 : 7.6;
        const x = editIconX;
        const y = editIconY;
        return [
          `M ${x - s * 0.55} ${y + s * 0.25}`,
          `L ${x + s * 0.25} ${y - s * 0.55}`,
          `L ${x + s * 0.65} ${y - s * 0.15}`,
          `L ${x - s * 0.15} ${y + s * 0.65}`,
          'Z',
          `M ${x - s * 0.65} ${y + s * 0.75}`,
          `L ${x - s * 0.25} ${y + s * 0.35}`
        ].join(' ');
      })
      .attr('fill', 'none')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.4)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('opacity', 0.92);

    addAction.style('cursor', 'pointer').on('click', (event, node) => {
      event.stopPropagation();
      onSelectNode?.(node);
      onAddRelative?.(node);
    });

    group
      .filter((node) => Boolean(node.placeholderKind))
      .style('cursor', 'pointer')
      .on('click', (event, placeholder) => {
        event.stopPropagation();
        const targetId = placeholder.placeholderForId;
        const kind = placeholder.placeholderKind;
        if (!targetId || !kind) {
          return;
        }
        const target = nodeById.get(targetId);
        if (!target) {
          return;
        }
        onSelectNode?.(target);
        onAddSpecificRelative?.(target, kind);
      });

    group
      .filter((node) => !node.placeholderKind)
      .on('click', (_, node) => {
        onSelectNode?.(node);
      });

    svg.attr('viewBox', `${minX} ${minY} ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMin meet');

  }, [data, getAvatarRingColor, getCardBorderColor, onAddRelative, onAddSpecificRelative, onSelectNode, selectedNodeId]);

  return <svg ref={svgRef} className="h-[58vh] min-h-[340px] w-full touch-none rounded-2xl border border-ubuntu-gray bg-slate-100 sm:h-[70vh] sm:min-h-[420px]" />;
}
