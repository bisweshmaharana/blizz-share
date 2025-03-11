import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { otp } = await req.json();
    
    // Validate OTP format (6 digits)
    if (!otp || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-digit OTP' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Find files with this OTP
    const file = await db.collection('files').findOne({ otp });
    
    if (!file) {
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 404 }
      );
    }
    
    // Check if files have expired
    const now = new Date();
    if (new Date(file.expiresAt) < now) {
      return NextResponse.json(
        { error: 'Files have expired' },
        { status: 410 }
      );
    }
    
    // Return file metadata (not URLs yet)
    // This maintains your preference to only show file details after OTP verification
    return NextResponse.json({
      success: true,
      message: 'Access Verified Successfully',
      passwordRequired: !!file.password,
      fileId: file.fileId,
      file: {
        name: file.fileName,
        size: file.fileSize
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
