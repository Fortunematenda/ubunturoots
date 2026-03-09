"use client";

import { useMemo, useState } from 'react';

type MemberOption = {
  id: string;
  fullName: string;
};

type RelationshipFinderFormProps = {
  members: MemberOption[];
  fixedPersonBId?: string;
  initialPersonA?: string;
  initialPersonB?: string;
};

type RelationshipPayload = {
  success?: boolean;
  data?: {
    relationship: string;
    relationship_path: string[];
    explanation: string;
    generationA: number;
    generationB: number;
  };
  error?: {
    message?: string;
  };
};

export function RelationshipFinderForm({ members, fixedPersonBId, initialPersonA, initialPersonB }: RelationshipFinderFormProps) {
  const defaultPersonA = initialPersonA && members.some((member) => member.id === initialPersonA) ? initialPersonA : members[0]?.id || '';
  const defaultPersonB =
    fixedPersonBId || (initialPersonB && members.some((member) => member.id === initialPersonB) ? initialPersonB : members[1]?.id || members[0]?.id || '');

  const [personA, setPersonA] = useState<string>(defaultPersonA);
  const [personB, setPersonB] = useState<string>(defaultPersonB);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RelationshipPayload['data'] | null>(null);

  const fixedPersonB = useMemo(() => members.find((member) => member.id === fixedPersonBId) || null, [fixedPersonBId, members]);

  async function findRelationship() {
    const resolvedPersonB = fixedPersonBId || personB;
    if (!personA || !resolvedPersonB) {
      setError('Please select both people.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const response = await fetch(`/api/relationship/${personA}/${resolvedPersonB}`, {
      method: 'GET',
      cache: 'no-store'
    });

    const payload = (await response.json().catch(() => ({}))) as RelationshipPayload;
    setLoading(false);

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message || 'Could not find relationship path.');
      return;
    }

    setResult(payload.data);
  }

  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-bold text-ubuntu-green">Relationship Finder</h2>
      <p className="text-sm text-slate-600">Who am I related to? Select two people and Ubuntu Roots will explain the connection path.</p>

      <label className="block text-sm font-semibold text-slate-700">
        Person A
        <select className="input mt-1" value={personA} onChange={(event) => setPersonA(event.target.value)}>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
      </label>

      {fixedPersonB ? (
        <div>
          <p className="text-sm font-semibold text-slate-700">Person B</p>
          <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold">{fixedPersonB.fullName}</p>
        </div>
      ) : (
        <label className="block text-sm font-semibold text-slate-700">
          Person B
          <select className="input mt-1" value={personB} onChange={(event) => setPersonB(event.target.value)}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
      )}

      <button className="btn-primary" type="button" onClick={findRelationship} disabled={loading}>
        {loading ? 'Finding Relationship...' : 'Find Relationship'}
      </button>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-xl border border-ubuntu-gray bg-slate-50 p-4">
          <p className="text-sm">
            <span className="font-bold text-ubuntu-green">Relationship:</span> {result.relationship}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-bold text-ubuntu-green">Path:</span> {result.relationship_path.join(' → ')}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-bold text-ubuntu-green">Explanation:</span> {result.explanation}
          </p>
          <p className="text-xs text-slate-500">
            Generation levels: Person A = {result.generationA}, Person B = {result.generationB}
          </p>
        </div>
      ) : null}
    </section>
  );
}
