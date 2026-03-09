"use client";

import { useEffect, useMemo, useRef } from 'react';

type TreeNode = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  gender?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
  spouseId?: string | null;
  status: 'ACTIVE' | 'DECEASED';
  birthYear?: number | null;
  deathDate?: string | null;
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

type FamilyTreeJsNode = {
  id: string;
  pid?: string;
  mid?: string;
  pids?: string[];
  nameLine1: string;
  nameLine2: string;
  birthLabel: string;
  deathLabel: string;
  img?: string;
  gender?: string | null;
  status: 'ACTIVE' | 'DECEASED';
};

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return [name.trim(), ''];
  }

  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(' '), parts.slice(midpoint).join(' ')];
}

function formatBirthLabel(node: TreeNode) {
  if (node.birthYear) return String(node.birthYear);
  if (node.status === 'DECEASED') return 'Deceased';
  return '';
}

function getNodeStroke(node: TreeNode, selectedNodeId?: string | null) {
  if (node.id === selectedNodeId) return '#10B981';
  if (node.gender === 'FEMALE') return '#FC8181';
  if (node.gender === 'MALE') return '#17B4CE';
  return '#94A3B8';
}

function getNodeRibbon(node: TreeNode) {
  if (node.status !== 'DECEASED') return '';
  if (node.gender === 'FEMALE') return '#F43F5E';
  if (node.gender === 'MALE') return '#0EA5E9';
  return '#64748B';
}

export function FamilyTreeCanvas({ data, selectedNodeId, onSelectNode, onAddRelative, onAddSpecificRelative }: FamilyTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const treeInstanceRef = useRef<any>(null);

  const familyNodes = useMemo<FamilyTreeJsNode[]>(() => {
    return data.nodes.map((node) => ({
      ...(() => {
        const [nameLine1, nameLine2] = splitDisplayName(node.fullName);
        return { nameLine1, nameLine2 };
      })(),
      id: node.id,
      pid: node.fatherId || undefined,
      mid: node.motherId || undefined,
      pids: node.spouseId ? [node.spouseId] : undefined,
      birthLabel: formatBirthLabel(node),
      deathLabel: node.deathDate ? new Date(node.deathDate).toLocaleDateString() : '',
      img: node.photoUrl || undefined,
      gender: node.gender,
      status: node.status
    }));
  }, [data.nodes]);

  useEffect(() => {
    let disposed = false;

    async function renderTree() {
      if (!containerRef.current) {
        return;
      }

      const module = await import('@balkangraph/familytree.js');
      if (disposed || !containerRef.current) {
        return;
      }

      const FamilyTree = (module.default ?? module) as any;

      if (treeInstanceRef.current?.destroy) {
        treeInstanceRef.current.destroy();
      }

      containerRef.current.innerHTML = '';

      if (FamilyTree.templates?.tommy) {
        FamilyTree.templates.ubuntuRoots = { ...FamilyTree.templates.tommy };
        FamilyTree.templates.ubuntuRoots.size = [240, 118];
        FamilyTree.templates.ubuntuRoots.node = `
          <g>
            <rect x="6" y="8" width="228" height="102" rx="18" ry="18" fill="#E2E8F0" opacity="0.35"></rect>
            <rect x="0" y="0" width="220" height="102" rx="8" ry="8" fill="#ffffff" stroke="{stroke}" stroke-width="2"></rect>
            <rect x="1.5" y="1.5" width="217" height="99" rx="7" ry="7" fill="none" stroke="{strokeSoft}" stroke-width="1"></rect>
            <path d="M0 16 L0 0 L16 0" fill="{ribbon}"></path>
          </g>`;
        FamilyTree.templates.ubuntuRoots.field_0 = '<text width="126" style="font-size:13px;font-weight:700;letter-spacing:0.4px;" fill="#000000" x="82" y="28" text-anchor="start">{val}</text>';
        FamilyTree.templates.ubuntuRoots.field_1 = '<text width="126" style="font-size:13px;font-weight:700;letter-spacing:0.4px;" fill="#000000" x="82" y="44" text-anchor="start">{val}</text>';
        FamilyTree.templates.ubuntuRoots.field_2 = '<text width="122" style="font-size:12px;" fill="#595959" x="96" y="64" text-anchor="start">{val}</text>';
        FamilyTree.templates.ubuntuRoots.field_3 = '<text width="122" style="font-size:12px;" fill="#595959" x="96" y="80" text-anchor="start">{val}</text>';
        FamilyTree.templates.ubuntuRoots.field_4 = '<text width="16" style="font-size:16px;font-weight:700;" fill="#595959" x="198" y="84" text-anchor="middle">{val}</text>';
        FamilyTree.templates.ubuntuRoots.img_0 = '<clipPath id="avatarClip_{id}"><circle cx="42" cy="51" r="30"></circle></clipPath><image preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip_{id})" xlink:href="{val}" x="12" y="21" width="60" height="60"></image><circle cx="42" cy="51" r="30" fill="none" stroke="#CCCCCC" stroke-width="1"></circle>';
        FamilyTree.templates.ubuntuRoots.defs = '<g id="ubuntuRootsBirthIcon"><path d="M6 1.5c.415 0 .75.336.75.75v2.451l2.125-1.226c.358-.206.817-.083 1.024.275.19.329.103.742-.189.968l-.085.056L7.5 6l2.125 1.226c.329.19.46.59.32.932l-.046.092c-.207.358-.666.481-1.024.275L6.75 7.298V9.75c0 .414-.335.75-.75.75s-.75-.336-.75-.75l-.001-2.452-2.124 1.227c-.358.206-.817.083-1.024-.275-.19-.329-.103-.742.189-.968l.085-.056L4.5 5.999 2.375 4.774c-.359-.206-.482-.665-.275-1.024.208-.358.667-.481 1.025-.275L5.25 4.701V2.25c0-.414.336-.75.75-.75H6z" fill="#595959"></path></g><g id="ubuntuRootsDeathIcon"><path d="M6 1.5c1.598 0 2.904 1.19 2.995 2.689L9 4.357 8.999 9h.251c.414 0 .75.336.75.75s-.336.75-.75.75h-6.5c-.414 0-.75-.336-.75-.75S2.336 9 2.75 9h.249L3 4.357C3 2.779 4.343 1.5 6 1.5zm1.5 2h-3c-.276 0-.5.224-.5.5 0 .245.177.45.41.492l.09.008h3c.276 0 .5-.224.5-.5s-.224-.5-.5-.5z" fill="#595959"></path></g>';
        FamilyTree.templates.ubuntuRoots.field_2 += '<use xlink:href="#ubuntuRootsBirthIcon" x="82" y="54"></use>';
        FamilyTree.templates.ubuntuRoots.field_3 += '<use xlink:href="#ubuntuRootsDeathIcon" x="82" y="70"></use>';
      }

      const tree = new FamilyTree(containerRef.current, {
        template: FamilyTree.templates?.ubuntuRoots ? 'ubuntuRoots' : undefined,
        mouseScrool: FamilyTree.action.zoom,
        enableSearch: false,
        nodeMouseClick: FamilyTree.action.none,
        miniMap: false,
        scaleInitial: FamilyTree.match.boundary,
        roots: selectedNodeId ? [selectedNodeId] : undefined,
        nodeMenu: {
          add: { text: 'Add Relative' }
        },
        nodeBinding: {
          field_0: 'nameLine1',
          field_1: 'nameLine2',
          field_2: 'birthLabel',
          field_3: 'deathLabel',
          field_4: 'editGlyph',
          img_0: 'img'
        },
        nodes: familyNodes.map((node) => ({
          id: node.id,
          pid: node.pid,
          mid: node.mid,
          pids: node.pids,
          nameLine1: node.nameLine1,
          nameLine2: node.nameLine2,
          birthLabel: node.birthLabel,
          deathLabel: node.deathLabel,
          img: node.img,
          editGlyph: '✎',
          stroke: getNodeStroke(data.nodes.find((item) => item.id === node.id) ?? ({ id: node.id, fullName: '', photoUrl: null, status: node.status } as TreeNode), selectedNodeId),
          strokeSoft: node.gender === 'FEMALE' ? '#FDA4AF' : node.gender === 'MALE' ? '#7DD3FC' : '#CBD5E1',
          ribbon: getNodeRibbon(data.nodes.find((item) => item.id === node.id) ?? ({ id: node.id, fullName: '', photoUrl: null, status: node.status } as TreeNode))
        }))
      });

      tree.on('click', (_sender: unknown, args: { node?: { id?: string } }) => {
        const nodeId = args?.node?.id;
        if (!nodeId) return;
        const node = data.nodes.find((item) => item.id === nodeId);
        if (node) onSelectNode?.(node);
      });

      tree.on('updatenode', (_sender: unknown, args: { node?: { id?: string }; menuItem?: string }) => {
        const nodeId = args?.node?.id;
        if (!nodeId || args?.menuItem !== 'add') return;
        const node = data.nodes.find((item) => item.id === nodeId);
        if (node) onAddRelative?.(node);
      });

      treeInstanceRef.current = tree;
    }

    renderTree().catch(() => {
      // no-op
    });

    return () => {
      disposed = true;
      if (treeInstanceRef.current?.destroy) {
        treeInstanceRef.current.destroy();
        treeInstanceRef.current = null;
      }
    };
  }, [familyNodes]);

  return (
    <div className="rounded-2xl border border-ubuntu-gray bg-[#F4F7F5] p-4">
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top,_#ffffff,_#eef4f1)] shadow-sm">
        <div ref={containerRef} className="h-[680px] w-full bg-transparent" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#DDE6E1] bg-white/80 px-3 py-3 shadow-sm backdrop-blur">
        <span className="mr-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#6B7F76]">Selected actions</span>
        {selectedNodeId && onAddRelative ? (
          <button
            type="button"
            className="rounded-full border border-[#D4E1DB] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#355E52] shadow-sm transition hover:bg-[#F3F8F5]"
            onClick={() => {
              const selected = data.nodes.find((node) => node.id === selectedNodeId);
              if (selected) {
                onAddRelative(selected);
              }
            }}
          >
            Add Relative
          </button>
        ) : null}

        {selectedNodeId && onAddSpecificRelative ? (
          <>
            <button
              type="button"
              className="rounded-full border border-[#D4E1DB] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#355E52] shadow-sm transition hover:bg-[#F3F8F5]"
              onClick={() => {
                const selected = data.nodes.find((node) => node.id === selectedNodeId);
                if (selected) {
                  onAddSpecificRelative(selected, 'father');
                }
              }}
            >
              Father
            </button>
            <button
              type="button"
              className="rounded-full border border-[#D4E1DB] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#355E52] shadow-sm transition hover:bg-[#F3F8F5]"
              onClick={() => {
                const selected = data.nodes.find((node) => node.id === selectedNodeId);
                if (selected) {
                  onAddSpecificRelative(selected, 'mother');
                }
              }}
            >
              Mother
            </button>
          </>
        ) : null}
        {!selectedNodeId ? <span className="text-xs font-medium text-slate-500">Tap a person in the tree to manage relatives.</span> : null}
      </div>
    </div>
  );
}
