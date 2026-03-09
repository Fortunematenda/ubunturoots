import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { otpVerifySchema } from '@/lib/validators';
import { setAuthCookie, signAuthToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid OTP request', 400, parsed.error.flatten());
    }

    const { phoneNumber, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || !user.lastOtpCode || !user.lastOtpExpires) {
      return fail('No OTP request found. Please request a new code.', 400);
    }

    if (user.lastOtpCode !== code) {
      return fail('Invalid OTP code', 401);
    }

    if (new Date() > user.lastOtpExpires) {
      return fail('OTP code expired', 401);
    }

    const token = signAuthToken({
      userId: user.id,
      memberId: user.memberId,
      role: user.role,
      phoneNumber: user.phoneNumber
    });

    setAuthCookie(token);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastOtpCode: null,
        lastOtpExpires: null
      }
    });

    return ok({
      message: 'Authenticated',
      role: user.role,
      memberId: user.memberId
    });
  } catch (error) {
    return fail('Failed to verify OTP', 500, error);
  }
}
