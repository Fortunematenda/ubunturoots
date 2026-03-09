import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    id: string;
  };
};

const inviteSchema = z.object({
  channels: z.array(z.enum(['SMS', 'WHATSAPP', 'EMAIL'])).min(1),
  recipient: z.string().trim().optional(),
  message: z.string().trim().optional()
});

function normalizePhone(input: string) {
  return input.replace(/\s+/g, '').trim();
}

function normalizeChannels(channels: Array<'SMS' | 'WHATSAPP' | 'EMAIL'>) {
  const unique = Array.from(new Set(channels));
  return unique.map((channel) => {
    if (channel === 'SMS') return NotificationChannel.SMS;
    if (channel === 'WHATSAPP') return NotificationChannel.WHATSAPP;
    return NotificationChannel.EMAIL;
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const member = await prisma.member.findUnique({
    where: { id: context.params.id },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true
    }
  });

  if (!member) {
    return fail('Member not found.', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON payload.', 400);
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid invite payload.', 400, parsed.error.flatten());
  }

  const channels = normalizeChannels(parsed.data.channels);
  const recipientOverride = parsed.data.recipient?.trim() || '';
  const customMessage = parsed.data.message?.trim() || '';

  const phoneRecipient = recipientOverride || member.phoneNumber || '';
  const notifications = channels.map((channel) => {
    if ((channel === NotificationChannel.SMS || channel === NotificationChannel.WHATSAPP) && !phoneRecipient) {
      return null;
    }

    if (channel === NotificationChannel.EMAIL) {
      const emailRecipient = recipientOverride;
      if (!emailRecipient || !/^\S+@\S+\.\S+$/.test(emailRecipient)) {
        return null;
      }

      return {
        title: 'Ubuntu Roots Family Invite',
        message:
          customMessage ||
          `${member.fullName} invited you to join Ubuntu Roots. Register and claim your family profile.`,
        channel,
        status: NotificationStatus.QUEUED,
        recipient: emailRecipient,
        sentAt: null
      };
    }

    return {
      title: 'Ubuntu Roots Family Invite',
      message:
        customMessage ||
        `${member.fullName} invited you to join Ubuntu Roots. Use this same phone number when signing up to claim your profile automatically.`,
      channel,
      status: NotificationStatus.QUEUED,
      recipient: normalizePhone(phoneRecipient),
      sentAt: null
    };
  }).filter(Boolean) as Array<{
    title: string;
    message: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    recipient: string;
    sentAt: null;
  }>;

  if (!notifications.length) {
    return fail('No valid recipients for selected channels.', 400);
  }

  await prisma.notification.createMany({
    data: notifications
  });

  return ok({
    queued: notifications.length,
    channels: notifications.map((item) => item.channel),
    claimHint: 'Invitee should register with the invited phone number to automatically claim this profile.'
  });
}
