import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from './prisma';

type NotifyOptions = {
  funeralCaseId?: string;
  title: string;
  message: string;
  channels?: NotificationChannel[];
};

export async function notifyAllMembers(options: NotifyOptions) {
  const members = await prisma.member.findMany({
    where: {
      status: 'ACTIVE',
      phoneNumber: { not: null }
    },
    select: {
      phoneNumber: true
    }
  });

  const channels = options.channels?.length ? options.channels : [NotificationChannel.IN_APP];

  const payload = members.flatMap((member) =>
    channels.map((channel) => ({
      funeralCaseId: options.funeralCaseId,
      title: options.title,
      message: options.message,
      channel,
      status: NotificationStatus.SENT,
      recipient: member.phoneNumber || 'Unknown',
      sentAt: new Date()
    }))
  );

  if (payload.length === 0) {
    return;
  }

  await prisma.notification.createMany({ data: payload });
}
