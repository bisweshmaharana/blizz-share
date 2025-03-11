import React from 'react';
import { FiEye, FiBell } from 'react-icons/fi';

interface NotificationBadgeProps {
  fileId: string;
  className?: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ fileId, className = '' }) => {
  const [hasNewAccess, setHasNewAccess] = React.useState(false);
  const [accessCount, setAccessCount] = React.useState(0);
  const [lastAccess, setLastAccess] = React.useState<string | null>(null);

  // Check for notifications
  React.useEffect(() => {
    if (!fileId) return;

    const checkNotifications = () => {
      try {
        // In a real app, this would poll an API endpoint
        // For now, we'll check localStorage for demo purposes
        const statsKey = `blizz-stats-${fileId}`;
        const existingStats = localStorage.getItem(statsKey);
        
        if (existingStats) {
          const stats = JSON.parse(existingStats);
          const lastSeenKey = `blizz-last-seen-${fileId}`;
          const lastSeen = localStorage.getItem(lastSeenKey);
          
          setAccessCount(stats.downloads || 0);
          setLastAccess(stats.lastDownload);
          
          // If there's a new download since last check
          if (stats.lastDownload && (!lastSeen || new Date(stats.lastDownload) > new Date(lastSeen))) {
            setHasNewAccess(true);
          }
        }
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    checkNotifications(); // Initial check
    const interval = setInterval(checkNotifications, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [fileId]);

  const markAsRead = () => {
    if (lastAccess) {
      localStorage.setItem(`blizz-last-seen-${fileId}`, lastAccess);
      setHasNewAccess(false);
    }
  };

  if (accessCount === 0) return null;

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onClick={markAsRead}
    >
      {hasNewAccess ? (
        <FiBell className="w-5 h-5 text-cyan-400" />
      ) : (
        <FiEye className="w-5 h-5 text-gray-400" />
      )}
      <span className="ml-2 text-sm">
        {accessCount} {accessCount === 1 ? 'access' : 'accesses'}
      </span>
      {hasNewAccess && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
      )}
    </div>
  );
};

export default NotificationBadge;
