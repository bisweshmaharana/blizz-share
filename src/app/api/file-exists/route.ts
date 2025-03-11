import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    // Get fileId from query parameters
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Find file with this ID
    const file = await db.collection('files').findOne({ fileId });
    
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Check if file has expired
    const now = new Date();
    if (new Date(file.expiresAt) < now) {
      return NextResponse.json(
        { error: 'File has expired' },
        { status: 410 }
      );
    }
    
    // Return minimal file info (just existence and password requirement)
    return NextResponse.json({
      exists: true,
      passwordRequired: !!file.password
    });
  } catch (error) {
    console.error('File exists check error:', error);
    return NextResponse.json(
      { error: 'Failed to check file existence' },
      { status: 500 }
    );
  }
}
