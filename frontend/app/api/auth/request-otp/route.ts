import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { generateOtpCode, getOtpExpiryDate, sendOtp } from '@/lib/otp';
import { otpRequestSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpRequestSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid phone number', 400, parsed.error.flatten());
    }

    const { phoneNumber } = parsed.data;
    const user = await prisma.user.findUnique({ where: { phoneNumber } });

    if (!user) {
      return fail('Phone number not found. Please create an account first.', 404);
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastOtpCode: code,
        lastOtpExpires: expiresAt
      }
    });

    await sendOtp(phoneNumber, code);

    return ok({
      message: 'OTP sent successfully',
      expiresAt
    });
  } catch (error) {
    return fail('Failed to request OTP', 500, error);
  }
}
