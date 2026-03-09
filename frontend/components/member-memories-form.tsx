"use client";

import { FormEvent, useState } from 'react';

type MemoryType = 'PHOTO' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

type MemberMemoriesFormProps = {
  memberId: string;
};

export function MemberMemoriesForm({ memberId }: MemberMemoriesFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [type, setType] = useState<MemoryType>('AUDIO');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    const response = await fetch(`/api/members/${memberId}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        fileUrl,
        type
      })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus(payload?.error?.message || 'Could not save memory');
      return;
    }

    setStatus('Memory saved.');
    setTitle('');
    setDescription('');
    setFileUrl('');
    setType('AUDIO');
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-bold text-ubuntu-green">Add Family Memory</h3>
      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <select className="input" value={type} onChange={(event) => setType(event.target.value as MemoryType)}>
        <option value="PHOTO">Photo</option>
        <option value="AUDIO">Audio</option>
        <option value="VIDEO">Video</option>
        <option value="DOCUMENT">Document</option>
      </select>
      <input
        className="input"
        placeholder="File URL (https://...)"
        value={fileUrl}
        onChange={(event) => setFileUrl(event.target.value)}
        required
      />
      <textarea
        className="input min-h-24"
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={800}
      />
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Memory'}
      </button>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
