// Global type declarations

declare global {
  interface Window {
    blizzFileStorage?: {
      [key: string]: any[];
    };
    blizzMetadata?: {
      [key: string]: {
        files: Array<{
          name: string;
          size: number;
          type: string;
          encrypted: boolean;
        }>;
        totalSize: number;
        totalFiles: number;
        expiryDate: string;
        requiresPassword: boolean;
        notifyOnAccess: boolean;
        encrypted: boolean;
      };
    };
  }
}

// Module declarations
declare module 'crypto-js';
declare module 'uuid';

export {}; // This is necessary to make this file a module
