"use client";

import { FormEvent, useMemo, useState } from 'react';

type RelationshipOption = 'spouse' | 'child' | 'parent' | 'sibling';
type ModeOption = 'new' | 'existing';

type MemberMatch = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  birthYear: number | null;
  location: string | null;
};

type FamilyConnectionManagerProps = {
  memberId: string;
};

const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipOption; label: string }> = [
  { value: 'spouse', label: 'Add Spouse' },
  { value: 'child', label: 'Add Child' },
  { value: 'parent', label: 'Add Parent' },
  { value: 'sibling', label: 'Add Sibling' }
];

function parseError(payload: unknown) {
  const maybe = payload as { error?: { message?: string; details?: unknown } };
  return {
    message: maybe?.error?.message || 'Unable to complete this request.',
    details: maybe?.error?.details
  };
}

export function FamilyConnectionManager({ memberId }: FamilyConnectionManagerProps) {
  const [relationshipType, setRelationshipType] = useState<RelationshipOption>('spouse');
  const [mode, setMode] = useState<ModeOption>('new');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('');
  const [existingQuery, setExistingQuery] = useState('');
  const [existingResults, setExistingResults] = useState<MemberMatch[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<MemberMatch[]>([]);
  const [siblingSuggestions, setSiblingSuggestions] = useState<MemberMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hasIdentityInput = useMemo(() => {
    return Boolean(fullName.trim() || phoneNumber.trim() || birthYear.trim());
  }, [fullName, phoneNumber, birthYear]);

  async function searchExistingMembers(event?: FormEvent) {
    event?.preventDefault();
    const query = existingQuery.trim();
    if (!query) {
      setExistingResults([]);
      return;
    }

    setIsLoading(true);
    setError('');

    const response = await fetch(`/api/members?query=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setError(parseError(payload).message);
      return;
    }

    const list = ((payload as { data?: MemberMatch[] }).data || []).filter((item) => item.id !== memberId).slice(0, 8);
    setExistingResults(list);
  }

  async function searchDuplicates() {
    if (!hasIdentityInput) {
      setError('Enter at least a name, phone, or birth year first.');
      return;
    }

    setIsLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (fullName.trim()) params.set('fullName', fullName.trim());
    if (phoneNumber.trim()) params.set('phoneNumber', phoneNumber.trim());
    if (birthYear.trim()) params.set('birthYear', birthYear.trim());
    params.set('excludeMemberId', memberId);

    const response = await fetch(`/api/members/suggestions?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setError(parseError(payload).message);
      return;
    }

    setDuplicateMatches((payload as { data?: MemberMatch[] }).data || []);
    setMessage('Duplicate check complete.');
  }

  async function searchSiblingSuggestions() {
    setIsLoading(true);
    setError('');
    setMessage('');
    setSiblingSuggestions([]);

    const response = await fetch(`/api/members/${memberId}/suggestions?type=siblings`, {
      method: 'GET'
    });
    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setError(parseError(payload).message);
      return;
    }

    setSiblingSuggestions((payload as { data?: MemberMatch[] }).data || []);
    setMessage('Sibling suggestions loaded.');
  }

  async function linkExisting(targetMemberId: string) {
    setIsLoading(true);
    setMessage('');
    setError('');

    const response = await fetch(`/api/members/${memberId}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relationshipType,
        targetMemberId
      })
    });

    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setError(parseError(payload).message);
      return;
    }

    setMessage('Family connection saved successfully. Refreshing...');
    setTimeout(() => window.location.reload(), 700);
  }

  async function createAndLink(forceCreate?: boolean) {
    setIsLoading(true);
    setMessage('');
    setError('');

    const response = await fetch(`/api/members/${memberId}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relationshipType,
        forceCreate,
        member: {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          birthYear: birthYear ? Number(birthYear) : undefined,
          location: location.trim(),
          gender: gender.trim()
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      const parsed = parseError(payload);
      setError(parsed.message);
      const details = parsed.details as { duplicates?: MemberMatch[] } | undefined;
      if (details?.duplicates?.length) {
        setDuplicateMatches(details.duplicates);
      }
      return;
    }

    setMessage('Family connection saved successfully. Refreshing...');
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <article className="card space-y-4 p-5">
      <h2 className="text-lg font-bold text-ubuntu-green">Build Immediate Family</h2>
      <p className="text-sm text-slate-600">Add spouse, children, siblings, and parents. Ubuntu Roots will auto-wire links.</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {RELATIONSHIP_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${
              relationshipType === item.value ? 'bg-ubuntu-green text-white' : 'bg-ubuntu-gray text-ubuntu-green'
            }`}
            onClick={() => {
              setRelationshipType(item.value);
              setMessage('');
              setError('');
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'new' ? 'bg-ubuntu-gold text-ubuntu-green' : 'bg-slate-100'}`}
          onClick={() => setMode('new')}
        >
          Create New Profile
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'existing' ? 'bg-ubuntu-gold text-ubuntu-green' : 'bg-slate-100'}`}
          onClick={() => setMode('existing')}
        >
          Link Existing Profile
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">Smart Suggestions</p>
            <p className="text-xs font-semibold text-slate-600">Find possible siblings based on shared parents.</p>
          </div>
          <button type="button" className="btn-secondary" disabled={isLoading} onClick={searchSiblingSuggestions}>
            {isLoading ? 'Loading...' : 'Suggest Siblings'}
          </button>
        </div>

        {siblingSuggestions.length ? (
          <div className="mt-3 space-y-2">
            {siblingSuggestions.map((match) => (
              <div key={match.id} className="rounded-lg bg-white p-3">
                <p className="font-semibold text-slate-800">{match.fullName}</p>
                <p className="text-xs text-slate-600">
                  {match.birthYear || 'Unknown year'} • {match.location || 'Unknown location'} • {match.phoneNumber || 'No phone'}
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-ubuntu-green"
                  onClick={() => {
                    setRelationshipType('sibling');
                    linkExisting(match.id);
                  }}
                >
                  Link as sibling
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {mode === 'existing' ? (
        <form className="space-y-3" onSubmit={searchExistingMembers}>
          <input
            className="input"
            placeholder="Search existing member by name, phone, or location"
            value={existingQuery}
            onChange={(event) => setExistingQuery(event.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search Members'}
          </button>

          {existingResults.length ? (
            <div className="space-y-2">
              {existingResults.map((match) => (
                <div key={match.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{match.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {match.location || 'Unknown location'} • {match.phoneNumber || 'No phone'}
                  </p>
                  <button type="button" className="mt-2 text-sm font-semibold text-ubuntu-green" onClick={() => linkExisting(match.id)}>
                    Link this profile
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </form>
      ) : (
        <div className="space-y-3">
          <input className="input" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <input className="input" placeholder="Phone (optional)" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          <input
            className="input"
            placeholder="Birth year (optional)"
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value.replace(/[^0-9]/g, ''))}
          />
          <input className="input" placeholder="Location (optional)" value={location} onChange={(event) => setLocation(event.target.value)} />
          <input className="input" placeholder="Gender (optional)" value={gender} onChange={(event) => setGender(event.target.value)} />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={isLoading} onClick={searchDuplicates}>
              Check Duplicates
            </button>
            <button type="button" className="btn-secondary" disabled={isLoading} onClick={searchSiblingSuggestions}>
              Suggest Siblings
            </button>
            <button type="button" className="btn-primary" disabled={isLoading || !fullName.trim()} onClick={() => createAndLink(false)}>
              {isLoading ? 'Saving...' : 'Create + Connect'}
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={isLoading || !fullName.trim()}
              onClick={() => createAndLink(true)}
            >
              Force Create
            </button>
          </div>

          {duplicateMatches.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-700">Possible duplicates found. Link one of these instead:</p>
              <div className="mt-2 space-y-2">
                {duplicateMatches.map((match) => (
                  <div key={match.id} className="rounded-lg bg-white p-2">
                    <p className="font-semibold text-slate-800">{match.fullName}</p>
                    <p className="text-xs text-slate-600">
                      {match.birthYear || 'Unknown year'} • {match.phoneNumber || 'No phone'}
                    </p>
                    <button type="button" className="text-sm font-semibold text-ubuntu-green" onClick={() => linkExisting(match.id)}>
                      Link this person
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-slate-600">{message}</p> : null}
    </article>
  );
}
