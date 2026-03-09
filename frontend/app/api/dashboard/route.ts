import { getDashboardSummary } from '@/lib/dashboard';
import { fail, ok } from '@/lib/http';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  try {
    const summary = await getDashboardSummary();
    return ok(summary);
  } catch (error) {
    return fail('Failed to fetch dashboard summary', 500, error);
  }
}
