import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { signupSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid signup request', 400, parsed.error.flatten());
    }

    const { fullName, phoneNumber } = parsed.data;
    const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });

    if (existingUser) {
      return fail('Phone number already registered. Please login.', 409);
    }

    const linkedMember = await prisma.member.findFirst({ where: { phoneNumber } });

    const user = await prisma.user.create({
      data: {
        fullName,
        phoneNumber,
        role: Role.MEMBER,
        memberId: linkedMember?.id || null
      }
    });

    return ok(
      {
        message: 'Signup successful. Request OTP to login.',
        userId: user.id,
        role: user.role
      },
      201
    );
  } catch (error) {
    return fail('Failed to signup', 500, error);
  }
}
