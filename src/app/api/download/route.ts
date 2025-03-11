import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { fileId, otp, password } = await req.json();
    
    if (!fileId || !otp) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Find file by ID and OTP
    const file = await db.collection('files').findOne({ fileId, otp });
    
    if (!file) {
      return NextResponse.json({ error: 'Invalid file ID or OTP' }, { status: 404 });
    }
    
    // Check if file has expired
    if (new Date() > new Date(file.expiresAt)) {
      return NextResponse.json({ error: 'This file has expired' }, { status: 410 });
    }
    
    // Check password if required
    if (file.password && file.password !== password) {
      return NextResponse.json(
        { error: 'Password required', passwordRequired: true },
        { status: 401 }
      );
    }
    
    // Generate download URL from Cloudinary
    const url = cloudinary.url(file.cloudinaryId, {
      secure: true,
      resource_type: 'auto'
    });
    
    // Return file details and download URL
    return NextResponse.json({
      success: true,
      fileName: file.fileName,
      fileSize: file.fileSize,
      downloadUrl: url
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
