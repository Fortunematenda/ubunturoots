export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getOtpExpiryDate() {
  const ttl = Number(process.env.OTP_TTL_MINUTES || 10);
  const date = new Date();
  date.setMinutes(date.getMinutes() + ttl);
  return date;
}

export async function sendOtp(phoneNumber: string, code: string) {
  // In production integrate with an SMS provider such as Twilio or Africa's Talking.
  console.info(`[OTP] Send code ${code} to ${phoneNumber}`);
  return true;
}
