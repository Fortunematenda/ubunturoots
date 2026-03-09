import { PrismaClient, Role, MemberStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.funeralCase.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.memorialMessage.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();

  const [grace, peter, john, amina, david] = await Promise.all([
    prisma.member.create({
      data: {
        memberCode: 'UBR-001',
        fullName: 'Grace Ndlovu',
        phoneNumber: '+27110000001',
        gender: 'Female',
        birthYear: 1952,
        location: 'Johannesburg',
        status: MemberStatus.ACTIVE
      }
    }),
    prisma.member.create({
      data: {
        memberCode: 'UBR-002',
        fullName: 'Peter Ndlovu',
        phoneNumber: '+27110000002',
        gender: 'Male',
        birthYear: 1950,
        location: 'Pretoria',
        status: MemberStatus.ACTIVE
      }
    }),
    prisma.member.create({
      data: {
        memberCode: 'UBR-003',
        fullName: 'John Ndlovu',
        phoneNumber: '+27110000003',
        gender: 'Male',
        birthYear: 1982,
        location: 'Soweto',
        status: MemberStatus.ACTIVE
      }
    }),
    prisma.member.create({
      data: {
        memberCode: 'UBR-004',
        fullName: 'Amina Ndlovu',
        phoneNumber: '+27110000004',
        gender: 'Female',
        birthYear: 1985,
        location: 'Soweto',
        status: MemberStatus.ACTIVE
      }
    }),
    prisma.member.create({
      data: {
        memberCode: 'UBR-005',
        fullName: 'David Ndlovu',
        phoneNumber: '+27110000005',
        gender: 'Male',
        birthYear: 1977,
        location: 'Durban',
        status: MemberStatus.DECEASED,
        deathDate: new Date('2025-08-05')
      }
    })
  ]);

  await prisma.member.update({
    where: { id: john.id },
    data: {
      fatherId: peter.id,
      motherId: grace.id,
      spouseId: amina.id
    }
  });

  await prisma.member.update({
    where: { id: amina.id },
    data: {
      spouseId: john.id
    }
  });

  await prisma.relationship.createMany({
    data: [
      { sourceId: peter.id, targetId: john.id, type: 'PARENT' },
      { sourceId: grace.id, targetId: john.id, type: 'PARENT' },
      { sourceId: john.id, targetId: amina.id, type: 'SPOUSE' }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        fullName: 'Family Leader',
        phoneNumber: '+27119990001',
        role: Role.SUPER_ADMIN,
        memberId: grace.id
      },
      {
        fullName: 'Treasurer',
        phoneNumber: '+27119990002',
        role: Role.TREASURER,
        memberId: peter.id
      },
      {
        fullName: 'Family Member',
        phoneNumber: '+27119990003',
        role: Role.MEMBER,
        memberId: john.id
      }
    ]
  });

  const funeralCase = await prisma.funeralCase.create({
    data: {
      deceasedMemberId: david.id,
      dateOfDeath: new Date('2025-08-05'),
      funeralDate: new Date('2025-08-13'),
      funeralLocation: 'Soweto Community Hall',
      familyMessage: 'Let us stand together and honor David with unity.',
      contributionPerMember: 200,
      totalExpectedContribution: 800,
      createdByUserId: 'system'
    }
  });

  const contributors = [grace, peter, john, amina];
  await prisma.contribution.createMany({
    data: contributors.map((member, index) => ({
      funeralCaseId: funeralCase.id,
      memberId: member.id,
      amount: 200,
      status: index < 2 ? PaymentStatus.PAID : PaymentStatus.PENDING
    }))
  });

  await prisma.payment.createMany({
    data: [
      {
        funeralCaseId: funeralCase.id,
        memberId: grace.id,
        amount: 200,
        paymentDate: new Date('2025-08-07'),
        paymentMethod: 'Cash',
        createdByUserId: 'system'
      },
      {
        funeralCaseId: funeralCase.id,
        memberId: peter.id,
        amount: 200,
        paymentDate: new Date('2025-08-08'),
        paymentMethod: 'EFT',
        createdByUserId: 'system'
      }
    ]
  });

  await prisma.expense.createMany({
    data: [
      {
        funeralCaseId: funeralCase.id,
        category: 'Coffin',
        amount: 250,
        expenseDate: new Date('2025-08-09'),
        recordedByUserId: 'system'
      },
      {
        funeralCaseId: funeralCase.id,
        category: 'Food',
        amount: 90,
        expenseDate: new Date('2025-08-10'),
        recordedByUserId: 'system'
      }
    ]
  });

  await prisma.notification.createMany({
    data: [
      {
        funeralCaseId: funeralCase.id,
        title: 'Funeral Contribution Request',
        message: 'Please contribute R200 for David Ndlovu funeral support.',
        channel: 'IN_APP',
        status: 'SENT',
        recipient: 'All members',
        sentAt: new Date()
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
