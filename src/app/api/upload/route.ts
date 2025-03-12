import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import clientPromise from '@/lib/mongodb';
import { generateOTP, generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Get form data with file
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const password = formData.get('password') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create a data URL for Cloudinary upload
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: 'blizz-share',
      resource_type: 'auto'
    });
    
    // Generate 6-character file ID and 6-digit OTP
    const fileId = generateId(6);
    const otp = generateOTP();
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Store file metadata
    await db.collection('files').insertOne({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      cloudinaryId: result.public_id,
      password: password || null,
      otp,
      downloadCount: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    // Track user upload (for daily limit)
    const userIp = req.headers.get('x-forwarded-for') || 'unknown';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await db.collection('user-tracking').updateOne(
      { userId: userIp, date: today },
      { $inc: { totalBytes: file.size } },
      { upsert: true }
    );
    
    // Return file ID and OTP
    return NextResponse.json({
      success: true,
      fileId,
      otp,
      shareLink: `${req.nextUrl.origin}/${fileId}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
