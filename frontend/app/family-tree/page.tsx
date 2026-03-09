import { FamilyTreeLazyLoader } from '@/components/family-tree-lazy-loader';

export default async function FamilyTreePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ubuntu-green">Interactive Family Tree</h1>
      <p className="text-sm text-slate-600">Pinch or scroll to zoom. Drag to pan. Tap a member to open profile. Nodes lazy-load in chunks for large families.</p>
      <FamilyTreeLazyLoader />
    </div>
  );
}
