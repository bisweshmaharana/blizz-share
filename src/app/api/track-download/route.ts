import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Get current file to check if it exists
    const file = await db.collection('files').findOne({ fileId });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get client IP and user agent to create a unique identifier for this download
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const downloadId = `${fileId}-${clientIp}-${userAgent}`;
    
    // Check if this specific client has already downloaded this file
    const existingDownload = await db.collection('download-tracking').findOne({ downloadId });
    
    if (existingDownload) {
      // This client has already downloaded this file
      return NextResponse.json({
        success: true,
        downloadCount: file.downloadCount || 0,
        message: 'Download already tracked'
      });
    }
    
    // Record this download to prevent duplicate counting
    await db.collection('download-tracking').insertOne({
      downloadId,
      fileId,
      timestamp: new Date()
    });
    
    // Update download count - increment by exactly 1
    await db.collection('files').updateOne(
      { fileId },
      { $inc: { downloadCount: 1 } }
    );
    
    // Get the updated file to return the current download count
    const updatedFile = await db.collection('files').findOne({ fileId });
    
    return NextResponse.json({
      success: true,
      downloadCount: updatedFile?.downloadCount || 1
    });
  } catch (error) {
    console.error('Track download error:', error);
    return NextResponse.json({ error: 'Failed to track download' }, { status: 500 });
  }
}
