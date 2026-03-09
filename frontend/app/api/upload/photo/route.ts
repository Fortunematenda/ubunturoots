import { NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const memberId = formData.get('memberId');
    const file = formData.get('file');

    if (!memberId || typeof memberId !== 'string') {
      return fail('memberId is required', 400);
    }

    if (!file || !(file instanceof File)) {
      return fail('Image file is required', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return fail('File exceeds 5MB limit', 400);
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return fail('Member not found', 404);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const outputName = `${memberId}-${Date.now()}.jpg`;
    const outputPath = path.join(uploadsDir, outputName);

    await sharp(bytes).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(outputPath);

    const publicUrl = `/uploads/${outputName}`;
    await prisma.member.update({
      where: { id: memberId },
      data: { photoUrl: publicUrl }
    });

    return ok({ photoUrl: publicUrl });
  } catch (error) {
    return fail('Upload failed', 500, error);
  }
}
