import { NextRequest, NextResponse } from 'next/server';

interface AccessRecord {
  type: string;
  timestamp: string;
}

interface FileStats {
  downloads: number;
  lastDownload: string | null;
  accessHistory: AccessRecord[];
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { fileId, accessType, timestamp } = data;
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // In a real app, this would send an email or push notification
    // For now, we'll update the stats in localStorage to be checked by the sender
    if (typeof window !== 'undefined') {
      // Get existing stats
      const statsKey = `blizz-stats-${fileId}`;
      const existingStatsStr = localStorage.getItem(statsKey);
      let stats: FileStats = { downloads: 0, lastDownload: null, accessHistory: [] };
      
      if (existingStatsStr) {
        try {
          const parsedStats = JSON.parse(existingStatsStr) as Partial<FileStats>;
          stats = {
            downloads: parsedStats.downloads || 0,
            lastDownload: parsedStats.lastDownload || null,
            accessHistory: Array.isArray(parsedStats.accessHistory) ? parsedStats.accessHistory : []
          };
        } catch (e) {
          console.error('Error parsing stats:', e);
        }
      }
      
      // Update stats
      stats.downloads += 1;
      stats.lastDownload = timestamp || new Date().toISOString();
      stats.accessHistory.push({
        type: accessType || 'download',
        timestamp: timestamp || new Date().toISOString()
      });
      
      // Store updated stats
      localStorage.setItem(statsKey, JSON.stringify(stats));
    }
    
    // Return success response
    return NextResponse.json({ success: true, message: 'Notification recorded' });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 });
  }
}
