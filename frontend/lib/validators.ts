import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^\+?[0-9]{8,20}$/, 'Invalid phone number format');

export const otpRequestSchema = z.object({
  phoneNumber: phoneSchema
});

export const otpVerifySchema = z.object({
  phoneNumber: phoneSchema,
  code: z.string().length(6)
});

export const signupSchema = z.object({
  fullName: z.string().min(2).max(120),
  phoneNumber: phoneSchema
});

export const memberCreateSchema = z.object({
  memberCode: z.string().min(3),
  fullName: z.string().min(2),
  photoUrl: z.string().url().optional().or(z.literal('')),
  phoneNumber: phoneSchema.optional(),
  gender: z.string().min(1),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  clanName: z.string().optional(),
  totem: z.string().optional(),
  tribe: z.string().optional(),
  originCountry: z.string().optional(),
  fatherId: z.string().optional(),
  motherId: z.string().optional(),
  spouseId: z.string().optional(),
  status: z.enum(['ACTIVE', 'DECEASED']).default('ACTIVE')
});

export const funeralCreateSchema = z.object({
  deceasedMemberId: z.string(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  dateOfDeath: z.string(),
  funeralDate: z.string(),
  funeralLocation: z.string().min(3),
  familyMessage: z.string().optional(),
  contributionPerMember: z.number().positive()
});

export const paymentCreateSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.string().min(2),
  notes: z.string().optional()
});

export const expenseCreateSchema = z.object({
  category: z.string().min(2),
  amount: z.number().positive(),
  expenseDate: z.string(),
  description: z.string().optional()
});

export const memorialMessageSchema = z.object({
  authorName: z.string().min(2),
  message: z.string().min(2).max(500)
});
