"use client";

import { ChangeEvent, useState } from 'react';

type PhotoUploadFormProps = {
  memberId: string;
};

export function PhotoUploadForm({ memberId }: PhotoUploadFormProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('memberId', memberId);

    setLoading(true);
    setMessage('');

    const response = await fetch('/api/upload/photo', {
      method: 'POST',
      body: formData
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error?.message || 'Upload failed');
      return;
    }

    setMessage('Photo uploaded successfully. Refreshing...');
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">Upload profile photo (max 5MB)</label>
      <input className="input" type="file" accept="image/*" onChange={onChange} disabled={loading} />
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
