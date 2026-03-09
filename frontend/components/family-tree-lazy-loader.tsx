"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FamilyTreeCanvas } from '@/components/family-tree-canvas';
import { buildFamilyTree } from '@/lib/tree';

type RelativeType = 'father' | 'mother' | 'spouse' | 'brother' | 'sister' | 'son' | 'daughter';

type ApiMember = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  phoneNumber?: string | null;
  location?: string | null;
  clanName?: string | null;
  totem?: string | null;
  tribe?: string | null;
  originCountry?: string | null;
  gender?: string | null;
  fatherId: string | null;
  motherId: string | null;
  spouseId: string | null;
  birthYear: number | null;
  status: 'ACTIVE' | 'DECEASED';
};

type LazyPayload = {
  success?: boolean;
  data?: {
    members?: ApiMember[];
    hasMore?: boolean;
    nextCursor?: string | null;
    loadedCount?: number;
  };
  error?: {
    message?: string;
    details?: {
      duplicates?: ApiMember[];
    };
  };
};

type AuthMePayload = {
  success?: boolean;
  data?: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
    role: string;
    memberId: string | null;
  };
  error?: {
    message?: string;
  };
};

type ApiItemPayload = {
  success?: boolean;
  data?: ApiMember;
  error?: {
    message?: string;
    details?: unknown;
  };
};

type ApiListPayload = {
  success?: boolean;
  data?: ApiMember[];
  error?: {
    message?: string;
    details?: unknown;
  };
};

const CHUNK_SIZE = 120;
const RELATIVE_OPTIONS: Array<{ value: RelativeType; label: string }> = [
  { value: 'father', label: '+ Father' },
  { value: 'mother', label: '+ Mother' },
  { value: 'spouse', label: '+ Spouse' },
  { value: 'brother', label: '+ Brother' },
  { value: 'sister', label: '+ Sister' },
  { value: 'son', label: '+ Son' },
  { value: 'daughter', label: '+ Daughter' }
];

function parseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const maybe = payload as { error?: { message?: string }; message?: string };
  return maybe.error?.message || maybe.message || fallback;
}

export function FamilyTreeLazyLoader() {
  const [membersById, setMembersById] = useState<Record<string, ApiMember>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRelativeType, setActiveRelativeType] = useState<RelativeType | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState<ApiMember[]>([]);
  const [existingQuery, setExistingQuery] = useState('');
  const [existingResults, setExistingResults] = useState<ApiMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [inviteSms, setInviteSms] = useState(true);
  const [inviteWhatsapp, setInviteWhatsapp] = useState(true);
  const [inviteEmail, setInviteEmail] = useState(false);
  const [inviteContact, setInviteContact] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [showProfileAddMenu, setShowProfileAddMenu] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [profileActionMessage, setProfileActionMessage] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editClanName, setEditClanName] = useState('');
  const [editTotem, setEditTotem] = useState('');
  const [editTribe, setEditTribe] = useState('');
  const [editOriginCountry, setEditOriginCountry] = useState('');
  const [firstMemberName, setFirstMemberName] = useState('');
  const [firstMemberGender, setFirstMemberGender] = useState('Unknown');
  const [firstMemberBirthDate, setFirstMemberBirthDate] = useState('');
  const [firstMemberLocation, setFirstMemberLocation] = useState('');
  const [firstMemberPhone, setFirstMemberPhone] = useState('');
  const [firstMemberMessage, setFirstMemberMessage] = useState('');
  const [authUser, setAuthUser] = useState<AuthMePayload['data'] | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const inviteSectionRef = useRef<HTMLElement | null>(null);
  const addRelativeSectionRef = useRef<HTMLElement | null>(null);

  const members = useMemo(() => Object.values(membersById), [membersById]);
  const tree = useMemo(() => buildFamilyTree(members), [members]);
  const selectedMember = selectedNodeId ? membersById[selectedNodeId] : null;

  function getYearFromDate(value: string) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return String(parsed.getFullYear());
  }

  const selectedParents = useMemo(() => {
    if (!selectedMember) return [] as ApiMember[];
    return [selectedMember.fatherId, selectedMember.motherId]
      .filter(Boolean)
      .map((id) => membersById[id as string])
      .filter(Boolean);
  }, [membersById, selectedMember]);

  const selectedChildren = useMemo(() => {
    if (!selectedMember) return [] as ApiMember[];
    return members.filter((member) => member.fatherId === selectedMember.id || member.motherId === selectedMember.id);
  }, [members, selectedMember]);

  const selectedSiblings = useMemo(() => {
    if (!selectedMember) return [] as ApiMember[];
    return members.filter((member) => {
      if (member.id === selectedMember.id) return false;
      if (!selectedMember.fatherId && !selectedMember.motherId) return false;
      return (
        (selectedMember.fatherId && member.fatherId === selectedMember.fatherId) ||
        (selectedMember.motherId && member.motherId === selectedMember.motherId)
      );
    });
  }, [members, selectedMember]);

  const selectedSpouse = selectedMember?.spouseId ? membersById[selectedMember.spouseId] : null;

  async function fetchChunk(cursorOverride?: string | null, reset = false) {
    if (isLoading || (!hasMore && !reset)) {
      return;
    }

    setIsLoading(true);
    setError('');

    const params = new URLSearchParams();
    params.set('lazy', '1');
    params.set('limit', String(CHUNK_SIZE));
    const cursorToUse = cursorOverride === undefined ? nextCursor : cursorOverride;
    if (cursorToUse) {
      params.set('cursor', cursorToUse);
    }

    try {
      const response = await fetch(`/api/family-tree?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json().catch(() => ({}))) as LazyPayload;

      if (!response.ok || !payload.success) {
        setError(payload.error?.message || 'Failed to load family tree nodes.');
        return;
      }

      const newMembers = payload.data?.members || [];
      setMembersById((prev) => {
        const merged = reset ? {} : { ...prev };
        newMembers.forEach((member) => {
          merged[member.id] = member;
        });
        return merged;
      });
      setHasMore(Boolean(payload.data?.hasMore));
      setNextCursor(payload.data?.nextCursor || null);
    } catch {
      setError('Could not reach family tree API.');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshTree() {
    await fetchChunk(null, true);
  }

  async function checkDuplicates() {
    if (!selectedMember || !activeRelativeType) {
      return;
    }

    const derivedBirthYear = getYearFromDate(birthDate);

    if (!fullName.trim() && !phoneNumber.trim() && !derivedBirthYear) {
      setFormMessage('Enter name, phone or birth year to check duplicates.');
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');

    const params = new URLSearchParams();
    if (fullName.trim()) params.set('fullName', fullName.trim());
    if (phoneNumber.trim()) params.set('phoneNumber', phoneNumber.trim());
    if (derivedBirthYear) params.set('birthYear', derivedBirthYear);
    params.set('excludeMemberId', selectedMember.id);

    const response = await fetch(`/api/members/suggestions?${params.toString()}`);
    const payload = (await response.json().catch(() => ({}))) as ApiListPayload;

    setIsSubmitting(false);

    if (!response.ok || !payload.success) {
      setFormMessage(parseErrorMessage(payload, 'Could not check duplicates.'));
      return;
    }

    setDuplicateMatches(payload.data || []);
    setFormMessage('Duplicate scan complete.');
  }

  async function linkExisting(targetMemberId: string) {
    if (!selectedMember || !activeRelativeType) {
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');

    const response = await fetch(`/api/members/${selectedMember.id}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relationshipType: activeRelativeType,
        targetMemberId
      })
    });
    const payload = (await response.json().catch(() => ({}))) as LazyPayload;

    setIsSubmitting(false);

    if (!response.ok || !payload.success) {
      setFormMessage(parseErrorMessage(payload, 'Could not link selected member.'));
      return;
    }

    setFormMessage('Relationship saved. Refreshing tree...');
    setActiveRelativeType(null);
    setDuplicateMatches([]);
    setExistingResults([]);
    setFullName('');
    setBirthDate('');
    setPhoneNumber('');
    setLocation('');
    setPhotoUrl('');
    await refreshTree();
  }

  async function createAndConnect(forceCreate = false) {
    if (!selectedMember || !activeRelativeType || !fullName.trim()) {
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');
    const derivedBirthYear = getYearFromDate(birthDate);

    const response = await fetch(`/api/members/${selectedMember.id}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relationshipType: activeRelativeType,
        forceCreate,
        member: {
          fullName: fullName.trim(),
          birthYear: derivedBirthYear ? Number(derivedBirthYear) : undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          location: location.trim() || undefined,
          photoUrl: photoUrl.trim() || undefined
        }
      })
    });
    const payload = (await response.json().catch(() => ({}))) as LazyPayload;

    setIsSubmitting(false);

    if (response.status === 409 && payload.error?.details?.duplicates?.length) {
      setDuplicateMatches(payload.error.details.duplicates);
      setFormMessage('This person may already exist. Link existing profile?');
      return;
    }

    if (!response.ok || !payload.success) {
      setFormMessage(parseErrorMessage(payload, 'Could not create family member.'));
      return;
    }

    setFormMessage('Relative added successfully. Refreshing tree...');
    setActiveRelativeType(null);
    setDuplicateMatches([]);
    setExistingResults([]);
    setFullName('');
    setBirthDate('');
    setPhoneNumber('');
    setLocation('');
    setPhotoUrl('');
    await refreshTree();
  }

  async function searchExisting(event?: FormEvent) {
    event?.preventDefault();
    const query = existingQuery.trim();
    if (!query || !selectedMember) {
      setExistingResults([]);
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');

    const response = await fetch(`/api/members?query=${encodeURIComponent(query)}`);
    const payload = (await response.json().catch(() => ({}))) as ApiListPayload;

    setIsSubmitting(false);

    if (!response.ok || !payload.success) {
      setFormMessage(parseErrorMessage(payload, 'Could not search members.'));
      return;
    }

    setExistingResults((payload.data || []).filter((member) => member.id !== selectedMember.id));
  }

  async function sendInvite() {
    if (!selectedMember) {
      return;
    }

    const channels: Array<'SMS' | 'WHATSAPP' | 'EMAIL'> = [];
    if (inviteSms) channels.push('SMS');
    if (inviteWhatsapp) channels.push('WHATSAPP');
    if (inviteEmail) channels.push('EMAIL');

    if (!channels.length) {
      setInviteStatus('Select at least one invite channel.');
      return;
    }

    setIsSubmitting(true);
    setInviteStatus('');

    const response = await fetch(`/api/members/${selectedMember.id}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channels,
        recipient: inviteContact.trim() || undefined,
        message: inviteMessage.trim() || undefined
      })
    });
    const payload = (await response.json().catch(() => ({}))) as LazyPayload;

    setIsSubmitting(false);

    if (!response.ok || !payload.success) {
      setInviteStatus(parseErrorMessage(payload, 'Failed to queue invitation.'));
      return;
    }

    setInviteStatus('Invitation queued successfully. Relative can claim profile after signup.');
  }

  function handleSelectRelative(relativeType: RelativeType) {
    setActiveRelativeType(relativeType);
    setShowProfileAddMenu(false);
    setShowMoreActions(false);
    setDuplicateMatches([]);
    setExistingResults([]);
    setFormMessage('');

    requestAnimationFrame(() => {
      addRelativeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function saveMemberEdits() {
    if (!selectedMember || !editFullName.trim()) {
      setProfileActionMessage('Full name is required.');
      return;
    }

    setIsSubmitting(true);
    setProfileActionMessage('');

    const body: Record<string, unknown> = {
      fullName: editFullName.trim(),
      birthYear: getYearFromDate(editBirthDate) ? Number(getYearFromDate(editBirthDate)) : undefined,
      location: editLocation.trim() || undefined,
      photoUrl: editPhotoUrl.trim() || '',
      clanName: editClanName.trim() || undefined,
      totem: editTotem.trim() || undefined,
      tribe: editTribe.trim() || undefined,
      originCountry: editOriginCountry.trim() || undefined
    };

    if (editPhoneNumber.trim()) {
      body.phoneNumber = editPhoneNumber.trim();
    }

    const response = await fetch(`/api/members/${selectedMember.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as ApiItemPayload;
    setIsSubmitting(false);

    if (!response.ok || !payload.success || !payload.data) {
      setProfileActionMessage(parseErrorMessage(payload, 'Could not update member profile.'));
      return;
    }

    setMembersById((prev) => ({
      ...prev,
      [payload.data!.id]: payload.data!
    }));
    setIsEditingMember(false);
    setProfileActionMessage('Profile updated successfully.');
  }

  async function handleCopyMemberId() {
    if (!selectedMember) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedMember.id);
      setProfileActionMessage('Member ID copied to clipboard.');
    } catch {
      setProfileActionMessage('Unable to copy Member ID from this browser.');
    }
  }

  function handleShowEdit() {
    if (!selectedMember) {
      return;
    }

    setEditFullName(selectedMember.fullName);
    setEditBirthDate(selectedMember.birthYear ? `${selectedMember.birthYear}-01-01` : '');
    setEditPhoneNumber(selectedMember.phoneNumber || '');
    setEditLocation(selectedMember.location || '');
    setEditPhotoUrl(selectedMember.photoUrl || '');
    setEditClanName(selectedMember.clanName || '');
    setEditTotem(selectedMember.totem || '');
    setEditTribe(selectedMember.tribe || '');
    setEditOriginCountry(selectedMember.originCountry || '');
    setShowProfileAddMenu(false);
    setShowMoreActions(false);
    setIsEditingMember((prev) => !prev);
    setProfileActionMessage('');
  }

  function handleMoreInvite() {
    setShowMoreActions(false);
    setShowProfileAddMenu(false);
    inviteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleMoreRefresh() {
    setShowMoreActions(false);
    await refreshTree();
    setProfileActionMessage('Family tree refreshed.');
  }

  async function createFirstMember() {
    if (members.length > 0) {
      return;
    }

    const rootName = (authUser?.fullName || firstMemberName).trim();
    const rootPhone = (firstMemberPhone || authUser?.phoneNumber || '').trim();

    if (!rootName) {
      setFirstMemberMessage('Could not load your profile name. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    setFirstMemberMessage('');

    const memberCode = `ROOT-${Date.now().toString().slice(-6)}`;
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        memberCode,
        fullName: rootName,
        gender: firstMemberGender,
        birthYear: getYearFromDate(firstMemberBirthDate) ? Number(getYearFromDate(firstMemberBirthDate)) : undefined,
        location: firstMemberLocation.trim() || undefined,
        phoneNumber: rootPhone || undefined,
        status: 'ACTIVE'
      })
    });

    const payload = (await response.json().catch(() => ({}))) as ApiItemPayload;
    setIsSubmitting(false);

    if (!response.ok || !payload.success || !payload.data) {
      setFirstMemberMessage(parseErrorMessage(payload, 'Could not create first member.'));
      return;
    }

    setMembersById((prev) => ({
      ...prev,
      [payload.data!.id]: payload.data!
    }));
    setSelectedNodeId(payload.data.id);
    setFirstMemberName('');
    setFirstMemberBirthDate('');
    setFirstMemberLocation('');
    setFirstMemberPhone('');
    setFirstMemberMessage('First member created. You can now tap the node and add relatives.');
    await refreshTree();
  }

  useEffect(() => {
    fetchChunk(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchAuthUser() {
      try {
        const response = await fetch('/api/auth/me', { method: 'GET', cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as AuthMePayload;

        if (!isMounted) return;

        if (!response.ok || !payload.success || !payload.data) {
          setFirstMemberMessage(parseErrorMessage(payload, 'Unable to load your account profile.'));
          return;
        }

        setAuthUser(payload.data);
        setFirstMemberName(payload.data.fullName || '');
        setFirstMemberPhone(payload.data.phoneNumber || '');
      } catch {
        if (isMounted) {
          setFirstMemberMessage('Unable to load your profile from this session.');
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    fetchAuthUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    setEditFullName(selectedMember.fullName);
    setEditBirthDate(selectedMember.birthYear ? `${selectedMember.birthYear}-01-01` : '');
    setEditPhoneNumber(selectedMember.phoneNumber || '');
    setEditLocation(selectedMember.location || '');
    setEditPhotoUrl(selectedMember.photoUrl || '');
    setEditClanName(selectedMember.clanName || '');
    setEditTotem(selectedMember.totem || '');
    setEditTribe(selectedMember.tribe || '');
    setEditOriginCountry(selectedMember.originCountry || '');
  }, [selectedMember]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ubuntu-gray bg-white p-3">
        <p className="text-sm text-slate-600">
          Loaded <span className="font-bold text-ubuntu-green">{members.length}</span> members
          {hasMore ? ' (more available)' : ''}
        </p>
        <button type="button" className="btn-primary" onClick={() => fetchChunk()} disabled={isLoading || !hasMore}>
          {isLoading ? 'Loading...' : hasMore ? `Load ${CHUNK_SIZE} More` : 'All Members Loaded'}
        </button>
      </div>

      {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      {!isLoading && members.length === 0 ? (
        <section className="card space-y-3 p-3 sm:p-4">
          <h2 className="text-lg font-bold text-ubuntu-green">Start Your Family Tree</h2>
          <p className="text-sm text-slate-600">No members were found yet. Your profile should be the first node, then you can add relatives from there.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Your Full Name" value={firstMemberName} disabled />
            <select className="input" value={firstMemberGender} onChange={(event) => setFirstMemberGender(event.target.value)}>
              <option value="Unknown">Unknown</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input className="input" type="date" value={firstMemberBirthDate} onChange={(event) => setFirstMemberBirthDate(event.target.value)} />
            <input className="input" placeholder="Location (optional)" value={firstMemberLocation} onChange={(event) => setFirstMemberLocation(event.target.value)} />
            <input className="input sm:col-span-2" placeholder="Your Phone" value={firstMemberPhone} onChange={(event) => setFirstMemberPhone(event.target.value)} />
          </div>
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={createFirstMember} disabled={isSubmitting || isAuthLoading || !firstMemberName.trim()}>
            {isSubmitting ? 'Creating...' : isAuthLoading ? 'Loading your profile...' : 'Create My Profile Node'}
          </button>
          {firstMemberMessage ? <p className="text-sm font-semibold text-slate-700">{firstMemberMessage}</p> : null}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          <div className="relative rounded-2xl border border-ubuntu-gray bg-white p-2">
            <FamilyTreeCanvas
              data={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={(node) => {
                setSelectedNodeId(node.id);
                setActiveRelativeType(null);
                setShowProfileAddMenu(false);
                setShowMoreActions(false);
                setIsEditingMember(false);
                setProfileActionMessage('');
                setDuplicateMatches([]);
                setExistingResults([]);
                setFormMessage('');
              }}
              onAddRelative={(node) => {
                setSelectedNodeId(node.id);
                setShowProfileAddMenu(true);
                setShowMoreActions(false);
                setIsEditingMember(false);
                setActiveRelativeType(null);
                setProfileActionMessage('');
                setFormMessage('');
              }}
              onAddSpecificRelative={(node, relativeType) => {
                setSelectedNodeId(node.id);
                handleSelectRelative(relativeType);
              }}
            />

            {selectedMember && showProfileAddMenu ? (
              <>
                <aside className="absolute left-2 right-2 bottom-2 top-auto z-10 max-h-[50vh] overflow-y-auto rounded-2xl border border-ubuntu-gray bg-white/95 p-2.5 shadow-lg backdrop-blur sm:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Relative</p>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      onClick={() => setShowProfileAddMenu(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {RELATIVE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`rounded-lg px-2 py-2 text-left text-xs font-semibold ${
                          activeRelativeType === option.value ? 'bg-ubuntu-green text-white' : 'bg-ubuntu-gray text-ubuntu-green'
                        }`}
                        onClick={() => handleSelectRelative(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="pointer-events-auto absolute inset-0 z-20 hidden sm:block">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/60"
                    onClick={() => setShowProfileAddMenu(false)}
                    aria-label="Close add relative"
                  />

                  <div className="absolute right-6 top-6 flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sm font-semibold text-white/90 hover:text-white"
                      onClick={() => setShowProfileAddMenu(false)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur"
                      onClick={() => setShowProfileAddMenu(false)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2">
                    <div className="relative mx-auto h-[520px] w-full">
                      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path
                          d="M 50 50 H 34"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <path
                          d="M 34 33 C 30 33, 30 38, 34 38 C 38 38, 38 33, 34 33 M 34 38 V 45 C 38 45, 38 50, 34 50 C 30 50, 30 45, 34 45"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <path
                          d="M 50 50 H 67"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <path
                          d="M 50 50 V 70"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <path
                          d="M 42 70 H 58"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <path
                          d="M 42 70 V 74 M 58 70 V 74"
                          fill="none"
                          stroke="#C5CCD6"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.82"
                        />
                        <circle cx="50" cy="50" r="1.6" fill="#C5CCD6" opacity="0.82" />
                      </svg>

                      <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(380px,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-ubuntu-green bg-white p-4 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editing node</p>
                            <p className="mt-1 truncate pr-8 text-base font-extrabold text-slate-900">{selectedMember.fullName}</p>
                          </div>
                          <span className="rounded-full bg-ubuntu-green px-3 py-1 text-[11px] font-extrabold text-white">Selected</span>
                        </div>

                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => {
                            setShowProfileAddMenu(false);
                            setIsEditingMember(true);
                          }}
                          aria-label="Edit member"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M14.06 6.19l3.75 3.75"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <p className="mt-2 text-sm font-semibold text-slate-600">
                          {selectedMember.birthYear || 'Birth year unknown'}
                          {selectedMember.location ? ` • ${selectedMember.location}` : ''}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{selectedMember.phoneNumber || ''}</p>
                      </div>

                      <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="absolute -left-[260px] -top-[110px] grid w-[220px] gap-3">
                          {RELATIVE_OPTIONS.filter((opt) => opt.value === 'brother' || opt.value === 'sister').map((option) => (
                            <button
                              key={`modal-left-${option.value}`}
                              type="button"
                              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg"
                              onClick={() => handleSelectRelative(option.value)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-700">
                                +
                              </span>
                              <span className="text-sm font-extrabold text-slate-900">Add {option.value}</span>
                            </button>
                          ))}
                        </div>

                        <div className="absolute left-[260px] -top-[55px] w-[260px]">
                          {RELATIVE_OPTIONS.filter((opt) => opt.value === 'spouse').map((option) => (
                            <button
                              key={`modal-right-${option.value}`}
                              type="button"
                              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg"
                              onClick={() => handleSelectRelative(option.value)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-700">
                                +
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-extrabold text-slate-900">Add another partner</span>
                                <span className="block text-xs font-semibold text-slate-500">Husband, ex-husband, partner, ...</span>
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="absolute -left-[160px] top-[180px] w-[240px]">
                          {RELATIVE_OPTIONS.filter((opt) => opt.value === 'son').map((option) => (
                            <button
                              key={`modal-bottom-${option.value}`}
                              type="button"
                              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg"
                              onClick={() => handleSelectRelative(option.value)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-700">
                                +
                              </span>
                              <span className="text-sm font-extrabold text-slate-900">Add son</span>
                            </button>
                          ))}
                        </div>

                        <div className="absolute left-[40px] top-[180px] w-[240px]">
                          {RELATIVE_OPTIONS.filter((opt) => opt.value === 'daughter').map((option) => (
                            <button
                              key={`modal-bottom2-${option.value}`}
                              type="button"
                              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg"
                              onClick={() => handleSelectRelative(option.value)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-700">
                                +
                              </span>
                              <span className="text-sm font-extrabold text-slate-900">Add daughter</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {selectedMember && activeRelativeType ? (
            <section ref={addRelativeSectionRef} className="card space-y-3 p-3 sm:p-4">
              <h2 className="text-lg font-bold text-ubuntu-green">Add {activeRelativeType} for {selectedMember.fullName}</h2>

              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" placeholder="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                <input className="input" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                <input className="input" placeholder="Phone (optional)" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
                <input className="input" placeholder="Location (optional)" value={location} onChange={(event) => setLocation(event.target.value)} />
                <input className="input sm:col-span-2" placeholder="Photo URL (optional)" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={checkDuplicates} disabled={isSubmitting}>
                  Check Duplicates
                </button>
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => createAndConnect(false)}
                  disabled={isSubmitting || !fullName.trim()}
                >
                  {isSubmitting ? 'Saving...' : 'Create + Connect'}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                  onClick={() => createAndConnect(true)}
                  disabled={isSubmitting || !fullName.trim()}
                >
                  Force Create
                </button>
              </div>

              <form className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3" onSubmit={searchExisting}>
                <p className="text-sm font-semibold text-slate-700">Link Existing Person</p>
                <input
                  className="input"
                  placeholder="Search by name, phone, location"
                  value={existingQuery}
                  onChange={(event) => setExistingQuery(event.target.value)}
                />
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting}>
                  Search Existing
                </button>
                {existingResults.length ? (
                  <div className="space-y-2">
                    {existingResults.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="font-semibold text-slate-800">{item.fullName}</p>
                        <p className="text-xs text-slate-500">{item.birthYear || 'Unknown year'} • {item.phoneNumber || 'No phone'}</p>
                        <button type="button" className="mt-1 text-xs font-semibold text-ubuntu-green" onClick={() => linkExisting(item.id)}>
                          Link this profile
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </form>

              {duplicateMatches.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-700">This person may already exist in the family tree. Link existing person?</p>
                  <div className="mt-2 space-y-2">
                    {duplicateMatches.map((match) => (
                      <div key={match.id} className="rounded-lg bg-white p-2">
                        <p className="font-semibold text-slate-800">{match.fullName}</p>
                        <p className="text-xs text-slate-500">{match.birthYear || 'Unknown year'} • {match.phoneNumber || 'No phone'}</p>
                        <button type="button" className="text-xs font-semibold text-ubuntu-green" onClick={() => linkExisting(match.id)}>
                          Link to existing person
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {formMessage ? <p className="text-sm font-semibold text-slate-700">{formMessage}</p> : null}
            </section>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="card p-3 sm:p-4">
            <h2 className="text-lg font-bold text-ubuntu-green">Member Profile</h2>
            {selectedMember ? (
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-base font-bold text-slate-900">{selectedMember.fullName}</p>
                  <p>{selectedMember.birthYear || 'Birth year unknown'} • {selectedMember.location || 'Location unknown'}</p>
                  <p>{selectedMember.phoneNumber || 'Phone not provided'}</p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <Link
                    href={`/members/${selectedMember.id}`}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                    onClick={handleShowEdit}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-ubuntu-green bg-ubuntu-green px-2 py-2 text-xs font-semibold text-white"
                    onClick={() => {
                      setShowProfileAddMenu((prev) => !prev);
                      setShowMoreActions(false);
                      setProfileActionMessage('');
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                    onClick={() => {
                      setShowMoreActions((prev) => !prev);
                      setShowProfileAddMenu(false);
                      setProfileActionMessage('');
                    }}
                  >
                    More
                  </button>
                </div>

                {showMoreActions ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                    <button type="button" className="w-full rounded-md bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700" onClick={handleMoreInvite}>
                      Go to Invite Relative
                    </button>
                    <button type="button" className="w-full rounded-md bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700" onClick={handleCopyMemberId}>
                      Copy Member ID
                    </button>
                    <button type="button" className="w-full rounded-md bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700" onClick={handleMoreRefresh}>
                      Refresh Family Tree
                    </button>
                  </div>
                ) : null}

                {isEditingMember ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit member profile</p>
                    <input className="input" placeholder="Full Name" value={editFullName} onChange={(event) => setEditFullName(event.target.value)} />
                    <input className="input" type="date" value={editBirthDate} onChange={(event) => setEditBirthDate(event.target.value)} />
                    <input className="input" placeholder="Phone" value={editPhoneNumber} onChange={(event) => setEditPhoneNumber(event.target.value)} />
                    <input className="input" placeholder="Location" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} />
                    <input className="input" placeholder="Clan Name" value={editClanName} onChange={(event) => setEditClanName(event.target.value)} />
                    <input className="input" placeholder="Totem" value={editTotem} onChange={(event) => setEditTotem(event.target.value)} />
                    <input className="input" placeholder="Tribe" value={editTribe} onChange={(event) => setEditTribe(event.target.value)} />
                    <input className="input" placeholder="Origin Country" value={editOriginCountry} onChange={(event) => setEditOriginCountry(event.target.value)} />
                    <input className="input" placeholder="Photo URL" value={editPhotoUrl} onChange={(event) => setEditPhotoUrl(event.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary w-full sm:w-auto" onClick={saveMemberEdits} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                        onClick={() => setIsEditingMember(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {profileActionMessage ? <p className="text-sm font-semibold text-slate-700">{profileActionMessage}</p> : null}

                {showProfileAddMenu ? (
                  <div className="rounded-xl border border-ubuntu-gray bg-slate-50 p-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Choose relative to add</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {RELATIVE_OPTIONS.map((option) => (
                        <button
                          key={`profile-${option.value}`}
                          type="button"
                          className={`rounded-lg px-2 py-2 text-left text-xs font-semibold ${
                            activeRelativeType === option.value ? 'bg-ubuntu-green text-white' : 'bg-white text-ubuntu-green'
                          }`}
                          onClick={() => handleSelectRelative(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="font-semibold text-ubuntu-green">Parents</p>
                  <ul className="list-disc pl-5">
                    {selectedParents.length ? selectedParents.map((item) => <li key={item.id}>{item.fullName}</li>) : <li>Not listed</li>}
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-ubuntu-green">Spouse</p>
                  <p>{selectedSpouse?.fullName || 'Not listed'}</p>
                </div>

                <div>
                  <p className="font-semibold text-ubuntu-green">Children</p>
                  <ul className="list-disc pl-5">
                    {selectedChildren.length ? selectedChildren.map((item) => <li key={item.id}>{item.fullName}</li>) : <li>Not listed</li>}
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-ubuntu-green">Siblings</p>
                  <ul className="list-disc pl-5">
                    {selectedSiblings.length ? selectedSiblings.map((item) => <li key={item.id}>{item.fullName}</li>) : <li>Not listed</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Tap a person node to view profile details and add relatives.</p>
            )}
          </section>

          {selectedMember ? (
            <section ref={inviteSectionRef} className="card space-y-3 p-3 sm:p-4">
              <h2 className="text-lg font-bold text-ubuntu-green">Invite Relative</h2>
              <p className="text-sm text-slate-600">Send invite via SMS, WhatsApp, or Email. They can claim this profile after signup.</p>

              <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteSms} onChange={(e) => setInviteSms(e.target.checked)} />SMS</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteWhatsapp} onChange={(e) => setInviteWhatsapp(e.target.checked)} />WhatsApp</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteEmail} onChange={(e) => setInviteEmail(e.target.checked)} />Email</label>
              </div>

              <input
                className="input"
                placeholder="Recipient contact (optional override)"
                value={inviteContact}
                onChange={(event) => setInviteContact(event.target.value)}
              />
              <textarea
                className="input min-h-24"
                placeholder="Personal invite note (optional)"
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
              />
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={sendInvite} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
              {inviteStatus ? <p className="text-sm font-semibold text-slate-700">{inviteStatus}</p> : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
