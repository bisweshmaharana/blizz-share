import clientPromise from './mongodb';

export async function initializeDatabase() {
  try {
    const client = await clientPromise;
    const db = client.db('blizz-share');
    
    // Get list of collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Create collections if they don't exist
    if (!collectionNames.includes('files')) {
      await db.createCollection('files');
      // Create TTL index for auto-deletion after 24 hours
      await db.collection('files').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 86400 }
      );
    }
    
    if (!collectionNames.includes('user-tracking')) {
      await db.createCollection('user-tracking');
    }
    
    console.log('Database initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Database initialization error:', error);
    return { success: false, error };
  }
}
