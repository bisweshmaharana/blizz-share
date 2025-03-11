// Type declarations for external modules
declare module 'crypto-js';
declare module 'uuid';
declare module 'qrcode.react';

// Add TypeScript interface for window object extension
declare global {
  interface Window {
    blizzFileStorage?: Record<string, any>;
  }
}
