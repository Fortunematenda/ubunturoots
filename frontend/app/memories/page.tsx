import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function MemoriesPage() {
  const memories = await prisma.familyMemory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      member: {
        select: {
          id: true,
          fullName: true
        }
      }
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ubuntu-green">Family Memories</h1>
          <p className="text-sm text-slate-600">Recent audio, video, documents, and photos attached to member profiles.</p>
        </div>
        <Link href="/directory" className="btn-secondary">
          Browse Members
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        {memories.length ? (
          memories.map((memory) => (
            <article key={memory.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{memory.title}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{memory.type}</p>
                </div>
                {memory.member ? (
                  <Link href={`/members/${memory.member.id}`} className="text-sm font-semibold text-ubuntu-green">
                    {memory.member.fullName} →
                  </Link>
                ) : null}
              </div>

              {memory.description ? <p className="mt-3 text-sm text-slate-600">{memory.description}</p> : null}

              <a className="mt-3 inline-block text-sm font-semibold text-ubuntu-green" href={memory.fileUrl} target="_blank" rel="noreferrer">
                Open file →
              </a>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-600">No memories uploaded yet.</p>
        )}
      </section>
    </div>
  );
}
