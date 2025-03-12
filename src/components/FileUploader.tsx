"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { FiUpload, FiFile, FiX, FiLock, FiLink, FiClock, FiCheck, FiEye, FiCopy, FiDownload, FiEyeOff, FiInfo, FiShield } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode.react';
import { useDropzone } from 'react-dropzone';
import '../components/LightningBorder.css';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { openDB, IDBPDatabase } from 'idb';
import NotificationBadge from './NotificationBadge';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type FileWithPreview = File & {
  preview?: string;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  encrypted?: boolean;
  size: number;
  name: string;
  originalFile: File;
};

type ShareSettings = {
  password: string;
  expiry: '10m' | '1h' | '24h' | '7d' | '30d' | 'custom';
  customExpiry?: number;
  oneTimeAccess: boolean;
  notifyOnAccess: boolean;
};

interface BlizzDB extends IDBPDatabase {
  files: {
    key: string;
    value: File;
  };
}

const FileUploader = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'share' | 'receive'>('upload');
  const [shareLink, setShareLink] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [downloadStats, setDownloadStats] = useState<{ downloads: number; lastDownload: string | null }>({ downloads: 0, lastDownload: null });
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    password: '',
    expiry: '24h',
    customExpiry: 24,
    oneTimeAccess: false,
    notifyOnAccess: false,
  });
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareId, setShareId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeMode, setActiveMode] = useState<'none' | 'upload' | 'receive'>('none');
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({});
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [verifiedFiles, setVerifiedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [currentFileId, setCurrentFileId] = useState('');

  // Ensure consistent file ID generation
  const generateFileId = (): string => {
    // Generate a short, unique 6-character ID
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    // Check if ID already exists in localStorage
    if (localStorage.getItem(`blizz-otp-${result}`)) {
      // If exists, generate a new one recursively
      return generateFileId();
    }
    
    return result;
  };

  // Calculate total size of files
  const getTotalSize = (files: FileWithPreview[]) => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  // Check daily transfer limit (5GB per day)
  const checkDailyTransferLimit = (newFilesSize: number) => {
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    const dailyTransferKey = `blizz-daily-transfer-${today}`;
    
    // Get current daily transfer amount from localStorage
    const currentDailyTransfer = parseInt(localStorage.getItem(dailyTransferKey) || '0', 10);
    
    // Calculate new total if these files are added
    const newDailyTotal = currentDailyTransfer + newFilesSize;
    
    // 5GB limit in bytes
    const dailyLimit = 5 * 1024 * 1024 * 1024;
    
    if (newDailyTotal > dailyLimit) {
      const remainingBytes = Math.max(0, dailyLimit - currentDailyTransfer);
      setError(`Daily transfer limit of 5GB reached. You have ${formatBytes(remainingBytes)} remaining today.`);
      return false;
    }
    
    return true;
  };

  // Update daily transfer amount after successful upload
  const updateDailyTransferAmount = (uploadedBytes: number) => {
    const today = new Date().toISOString().split('T')[0];
    const dailyTransferKey = `blizz-daily-transfer-${today}`;
    
    // Get current daily transfer amount
    const currentDailyTransfer = parseInt(localStorage.getItem(dailyTransferKey) || '0', 10);
    
    // Update with new amount
    localStorage.setItem(dailyTransferKey, (currentDailyTransfer + uploadedBytes).toString());
  };

  // Check if adding new files would exceed size limit
  const checkSizeLimit = (newFiles: File[]) => {
    const newTotal = newFiles.reduce((total, file) => total + file.size, 0);
    
    // Check daily transfer limit
    return checkDailyTransferLimit(newTotal);
  };

  // Function to generate a share link based on the current origin
  const generateShareLink = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/${id}`;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!checkSizeLimit(acceptedFiles)) {
      return;
    }

    setError(''); // Clear any previous errors
    
    setActiveMode('upload');
    
    const newFiles = acceptedFiles.map(file => {
      const fileId = generateFileId();
      return {
        id: fileId,
        progress: 0,
        status: 'pending' as const,
        encrypted: false,
        size: file.size,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        preview: URL.createObjectURL(file),
        originalFile: file
      } as FileWithPreview;
    });
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Accept all file types with no restrictions
    accept: undefined,
    // Remove size limit (only keep the 50MB total limit check)
    maxSize: undefined,
    noClick: false,
    noKeyboard: false,
    preventDropOnDocument: true,
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(file => file.id !== id);
      return filtered;
    });
  };

  // Generate OTP for file sharing
  const generateOTP = () => {
    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  };

  // Handle file upload and sharing
  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select files to upload');
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      
      // Open IndexedDB
      const db = await openDB<BlizzDB>('blizz-share', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files');
          }
        },
      });
      
      // Generate a unique ID for this share
      const newShareId = generateFileId();
      setShareId(newShareId);
      
      // Generate OTP for this share
      const newOtp = generateOTP();
      setOtp(newOtp);
      
      // Store OTP in localStorage
      localStorage.setItem(`blizz-otp-${newShareId}`, newOtp);
      
      // Calculate expiry date based on settings
      let expiryDate = new Date();
      switch(shareSettings.expiry) {
        case '10m':
          expiryDate.setMinutes(expiryDate.getMinutes() + 10);
          break;
        case '1h':
          expiryDate.setHours(expiryDate.getHours() + 1);
          break;
        case '24h':
          expiryDate.setHours(expiryDate.getHours() + 24);
          break;
        case '7d':
          expiryDate.setDate(expiryDate.getDate() + 7);
          break;
        case '30d':
          expiryDate.setDate(expiryDate.getDate() + 30);
          break;
        case 'custom':
          if (shareSettings.customExpiry) {
            expiryDate.setHours(expiryDate.getHours() + shareSettings.customExpiry);
          } else {
            expiryDate.setHours(expiryDate.getHours() + 24); // Default to 24h
          }
          break;
        default:
          expiryDate.setHours(expiryDate.getHours() + 24); // Default to 24h
      }
      
      // Process each file
      const fileMetadata = [];
      let index = 0;
      
      for (const file of files) {
        // Update progress
        setFiles(prev => 
          prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'uploading' as const, progress: 0 } 
              : f
          )
        );
        
        // Simulate upload progress
        for (let i = 0; i <= 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const progress = i * 10;
          
          setFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, progress } 
                : f
            )
          );
        }
        
        // Store file in IndexedDB
        await db.put('files', file.originalFile, `${newShareId}-${index}`);
        
        // Add file metadata
        fileMetadata.push({
          name: file.name,
          size: file.size,
          id: newShareId,
          index: index
        });
        
        // Update file status
        setFiles(prev => 
          prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'complete' as const, progress: 100 } 
              : f
          )
        );
        
        index++;
      }
      
      // Store file metadata in localStorage
      const metadata = {
        files: fileMetadata,
        password: shareSettings.password,
        expiry: shareSettings.expiry,
        oneTimeAccess: shareSettings.oneTimeAccess,
        notifyOnAccess: shareSettings.notifyOnAccess,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(`blizz-meta-${newShareId}`, JSON.stringify(metadata));
      
      // Initialize download stats
      const stats = {
        downloads: 0,
        lastDownload: null
      };
      
      localStorage.setItem(`blizz-stats-${newShareId}`, JSON.stringify(stats));
      
      // Generate share link
      const shareLink = `${window.location.origin}/${newShareId}`;
      setShareLink(shareLink);
      
      // Update UI to show share details
      setActiveTab('share');
      setUploading(false);
      
      // Update daily transfer amount
      updateDailyTransferAmount(getTotalSize(files));
    } catch (error) {
      console.error('Upload error:', error);
      setError('An error occurred during upload. Please try again.');
      setUploading(false);
    }
  };

  // Generate a short, unique ID (6 characters)
  const generateShareId = () => {
    // Use characters that are easy to read and type
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const id = Array(6)
      .fill(0)
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join('');
    console.log('Generated share ID:', id);
    return id;
  };

  const handleShare = async () => {
    if (files.length === 0) {
      setError('Please upload at least one file first');
      return;
    }
    
    try {
      setError('');
      setActiveMode('upload'); // Ensure active mode is set to upload when sharing
      await handleUpload();
    } catch (error) {
      console.error('Error sharing files:', error);
      setError('Failed to share files. Please try again.');
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'upload' | 'share' | 'receive') => {
    // Don't allow switching to upload tab when in receive mode
    if (tab === 'upload' && activeMode === 'receive') {
      return;
    }
    
    // Don't allow switching to receive tab when in upload mode
    if (tab === 'receive' && activeMode === 'upload') {
      return;
    }
    
    // Don't allow switching to share tab when no share link or in receive mode
    if (tab === 'share' && (!shareLink || activeMode === 'receive')) {
      return;
    }
    
    setActiveTab(tab);
    setError('');
  };

  // Encrypt file (simulation)
  const encryptFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // In a real app, we would encrypt the file here
      // This is just a simulation
      setTimeout(() => {
        const key = CryptoJS.lib.WordArray.random(16).toString();
        resolve(key);
      }, 500);
    });
  };

  // Clean up previews when component unmounts
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  }, [files]);

  const handleSettingsChange = (setting: keyof ShareSettings, value: any) => {
    setShareSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleCopy = async (text: string, key: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      if ('clipboard' in navigator) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        // Avoid scrolling to bottom
        textArea.style.cssText = 'position:fixed;left:0;top:0;opacity:0;';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
      }
      
      // Show success state with cyan accent color (matching design)
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
    }
  };

  // Format relative time
  const formatLastDownload = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Load download stats periodically
  useEffect(() => {
    if (!shareId) return;

    const loadStats = () => {
      try {
        const statsKey = `blizz-stats-${shareId}`;
        const existingStats = localStorage.getItem(statsKey);
        if (existingStats) {
          const stats = JSON.parse(existingStats);
          setDownloadStats(stats);
        }
      } catch (error) {
      }
    };

    loadStats(); // Initial load
    const interval = setInterval(loadStats, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [shareId]);

  // Update files state when files are added
  useEffect(() => {
    if (files.length > 0) {
      setActiveMode('upload');
    } else {
      // If no files, reset active mode unless we're in receive mode
      if (activeMode !== 'receive') {
        setActiveMode('none');
      }
    }
  }, [files.length, activeMode]);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (file: { name: string; size: number; id: string; index: number }) => {
    try {
      setLoading(true);
      setError('');
      
      // Get the file ID from the file object
      const fileId = file.id;
      
      // Open IndexedDB
      const db = await openDB<BlizzDB>('blizz-share', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files');
          }
        },
      });
      
      // Get the file blob from IndexedDB
      const fileBlob = await db.get('files', `${fileId}-${file.index}`);
      
      if (!fileBlob) {
        throw new Error('File not found in database');
      }
      
      // Update download stats
      if (currentFileId) {
        // Get current stats
        const statsStr = localStorage.getItem(`blizz-stats-${currentFileId}`);
        let stats = { downloads: 0, lastDownload: null as string | null };
        
        if (statsStr) {
          try {
            stats = JSON.parse(statsStr);
          } catch (e) {
            console.error('Error parsing stats:', e);
          }
        }
        
        // Update stats
        stats.downloads += 1;
        stats.lastDownload = new Date().toISOString();
        
        // Save updated stats
        localStorage.setItem(`blizz-stats-${currentFileId}`, JSON.stringify(stats));
        
        // Update UI
        setDownloadStats(stats);
        
        // Check if notification is enabled
        const metadataStr = localStorage.getItem(`blizz-meta-${currentFileId}`);
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          if (metadata.notifyOnAccess) {
            // In a real app, this would send a notification to the file owner
            console.log('Access notification would be sent to file owner');
          }
        }
      }
      
      // Create a download link
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setSuccessMessage(`Downloaded ${file.name} successfully`);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (verifiedFiles.length === 0) {
        setError('No files to download');
        return;
      }
      
      // Update download stats
      if (currentFileId) {
        // Get current stats
        const statsStr = localStorage.getItem(`blizz-stats-${currentFileId}`);
        let stats = { downloads: 0, lastDownload: null as string | null };
        
        if (statsStr) {
          try {
            stats = JSON.parse(statsStr);
          } catch (e) {
            console.error('Error parsing stats:', e);
          }
        }
        
        // Update stats
        stats.downloads += 1;
        stats.lastDownload = new Date().toISOString();
        
        // Save updated stats
        localStorage.setItem(`blizz-stats-${currentFileId}`, JSON.stringify(stats));
        
        // Update UI
        setDownloadStats(stats);
        
        // Check if notification is enabled
        const metadataStr = localStorage.getItem(`blizz-meta-${currentFileId}`);
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          if (metadata.notifyOnAccess) {
            // In a real app, this would send a notification to the file owner
            console.log('Access notification would be sent to file owner');
          }
        }
      }
      
      // If there's only one file, download it directly
      if (verifiedFiles.length === 1) {
        await handleDownload(verifiedFiles[0]);
        return;
      }
      
      // For multiple files, create a zip
      const zip = new JSZip();
      
      // Open IndexedDB
      const db = await openDB<BlizzDB>('blizz-share', 1);
      
      // Add each file to the zip
      for (const file of verifiedFiles) {
        const fileBlob = await db.get('files', `${file.id}-${file.index}`);
        if (fileBlob) {
          zip.file(file.name, fileBlob);
        }
      }
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the zip
      saveAs(zipBlob, 'blizz-files.zip');
      
      setSuccessMessage('All files downloaded successfully');
    } catch (error) {
      console.error('Download all error:', error);
      setError('Failed to download files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    const otpInput = document.getElementById('receiveOtp') as HTMLInputElement;
    const otp = otpInput?.value;
    
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    
    try {
      // Search for the file ID associated with this OTP
      let foundFileId = null;
      
      // Scan localStorage for matching OTP
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('blizz-otp-')) {
          const fileId = key.replace('blizz-otp-', '');
          const storedOtp = localStorage.getItem(key);
          
          if (storedOtp === otp) {
            foundFileId = fileId;
            break;
          }
        }
      }
      
      if (!foundFileId) {
        setError('Invalid OTP. Please check and try again.');
        setLoading(false);
        return;
      }
      
      // Store the current file ID
      setCurrentFileId(foundFileId);
      
      // Get file metadata
      const metadataStr = localStorage.getItem(`blizz-meta-${foundFileId}`);
      if (!metadataStr) {
        setError('File metadata not found.');
        setLoading(false);
        return;
      }
      
      const metadata = JSON.parse(metadataStr);
      
      // Check if password is required
      if (metadata.password) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      
      // If no password required, proceed with showing files
      const files = metadata.files || [];
      setVerifiedFiles(files);
      setIsOTPVerified(true);
      setError('');
      
      // Update download stats if available
      const statsStr = localStorage.getItem(`blizz-stats-${foundFileId}`);
      if (statsStr) {
        setDownloadStats(JSON.parse(statsStr));
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError('An error occurred while verifying the OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (!currentFileId) {
      setError('File ID not found. Please try again.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Get file metadata
      const metadataStr = localStorage.getItem(`blizz-meta-${currentFileId}`);
      if (!metadataStr) {
        setError('File metadata not found.');
        setLoading(false);
        return;
      }
      
      const metadata = JSON.parse(metadataStr);
      
      // Verify password
      if (metadata.password !== password) {
        setError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }
      
      // Password correct, show files
      const files = metadata.files || [];
      setVerifiedFiles(files);
      setIsOTPVerified(true);
      setPasswordRequired(false);
      setError('');
      
      // Update download stats if available
      const statsStr = localStorage.getItem(`blizz-stats-${currentFileId}`);
      if (statsStr) {
        setDownloadStats(JSON.parse(statsStr));
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setError('An error occurred while verifying the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => handleTabChange('upload')}
            disabled={activeMode === 'receive'}
            className={`flex-1 px-4 py-4 text-base font-medium ${
              activeTab === 'upload'
                ? 'text-cyan-500 border-b-2 border-cyan-500 font-bold'
                : activeMode === 'receive'
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Upload Files
          </button>
          <button
            onClick={() => handleTabChange('share')}
            disabled={!shareLink || activeMode === 'receive'}
            className={`flex-1 px-4 py-4 text-base font-medium ${
              activeTab === 'share'
                ? 'text-cyan-500 border-b-2 border-cyan-500 font-bold'
                : activeMode === 'receive'
                ? 'text-gray-600 cursor-not-allowed'
                : shareLink ? 'text-gray-300 hover:text-white' : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            Share Files
          </button>
          <button
            onClick={() => handleTabChange('receive')}
            disabled={activeMode === 'upload'}
            className={`flex-1 px-4 py-4 text-base font-medium ${
              activeTab === 'receive'
                ? 'text-cyan-500 border-b-2 border-cyan-500 font-bold'
                : activeMode === 'upload'
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Receive Files
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input {...getInputProps()} />
                  <FiUpload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg mb-2 text-gray-300">Click to upload or drag & drop</p>
                  <p className="text-sm text-gray-500">
                    Supported file types: All file formats available
                    <br />
                    <span className="text-cyan-500/80">5GB daily transfer limit</span>
                  </p>
                </div>

                {files.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg text-gray-300 mb-4">Files ({files.length})</h3>
                    <div className="space-y-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                        >
                          <div className="flex items-center space-x-4 min-w-0 flex-1">
                            <FiFile className="w-6 h-6 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-300 truncate">{file.name}</p>
                              <p className="text-sm text-gray-500">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                              {file.status === 'uploading' && (
                                <div className="w-48 h-1 mt-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-500 transition-all duration-300"
                                    style={{ width: `${file.progress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                            {file.encrypted && <FiLock className="w-5 h-5 text-cyan-500" />}
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                            >
                              <FiX className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="flex flex-col bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FiLock className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-300">Password Protection</span>
                            <span className="text-xs text-gray-500">(optional)</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={passwordEnabled} 
                              onChange={() => {
                                setPasswordEnabled(!passwordEnabled);
                                if (!passwordEnabled) {
                                  // Clear password when disabling
                                  setShareSettings({...shareSettings, password: ''});
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                          </label>
                        </div>
                        
                        {passwordEnabled && (
                          <div className="relative w-full mt-3">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder=""
                              className="w-full bg-gray-700 text-white px-3 py-2 rounded pr-10 border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
                              value={shareSettings.password}
                              onChange={(e) =>
                                setShareSettings({ ...shareSettings, password: e.target.value })
                              }
                            />
                            <button 
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <FiEye className="h-5 w-5" />
                              ) : (
                                <FiEyeOff className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <FiClock className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-300">Expiry Time</span>
                        </div>
                        <span className="text-gray-300">24 hours</span>
                      </div>

                      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <FiCheck className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-300">Notify on Access</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={shareSettings.notifyOnAccess}
                            onChange={(e) =>
                              setShareSettings({
                                ...shareSettings,
                                notifyOnAccess: e.target.checked,
                              })
                            }
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-cyan-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                      </div>

                      <button
                        onClick={handleShare}
                        disabled={uploading || files.length === 0}
                        className={`w-full py-3 rounded-lg font-medium ${
                          uploading || files.length === 0
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-cyan-500 text-white hover:bg-cyan-600'
                        }`}
                      >
                        {uploading ? 'Processing...' : 'Secure & Share Files'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'share' && (
              <motion.div
                key="share"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ backgroundColor: '#1a1a1a' }}
              >
                {shareLink && (
                  <div className="space-y-6 px-4 py-6 sm:px-6">
                    <div className="mb-6">
                      <h3 className="text-lg text-gray-300 mb-2">Share Link</h3>
                      <div className="lightning-container">
                        <div className="lightning-content flex items-center space-x-2 p-4">
                          <input
                            type="text"
                            value={shareLink}
                            readOnly
                            className="flex-1 bg-transparent text-gray-300 outline-none"
                          />
                          <button
                            onClick={() => handleCopy(shareLink, 'shareLink')}
                            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                            aria-label="Copy share link"
                          >
                            {copyStatus['shareLink'] ? (
                              <FiCheck className="w-5 h-5 text-cyan-500" />
                            ) : (
                              <FiLink className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-lg text-cyan-400 mb-2 text-center">One-Time Password</h3>
                      <div className="flex flex-col items-center">
                        <div className="lightning-container">
                          <div className="lightning-content flex items-center justify-center p-5 w-full">
                            <div className="flex-1 overflow-x-auto text-center">
                              <div className="flex justify-center tracking-[0.35em] sm:tracking-[0.5em]">
                                {otp.split('').map((digit, i) => (
                                  <span key={i} className="text-2xl sm:text-3xl text-cyan-500 font-mono">
                                    {digit}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopy(otp, 'otp')}
                              className="ml-3 p-2 hover:bg-gray-700 rounded-full transition-colors"
                              title="Copy OTP"
                            >
                              {copyStatus['otp'] ? (
                                <FiCheck className="w-5 h-5 text-cyan-500" />
                              ) : (
                                <FiCopy className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-3">
                          Share this password with the recipient to access the files
                        </p>
                      </div>
                    </div>

                    <div className="mb-6 flex justify-center">  
                      <h3 className="text-lg text-gray-300 mb-2">QR Code</h3>
                    </div>
                    <div className="mb-6 flex justify-center">  
                      <div className="inline-block bg-white p-4 rounded-lg">
                        <QRCode 
                          value={shareLink} 
                          size={200}
                          level="H"
                          includeMargin={true}
                          imageSettings={null}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                        />
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-gray-400">
                        <FiClock className="w-5 h-5" />
                        <span>Expires in 24 hours</span>
                      </div>
                    </div>

                    {downloadStats.downloads > 0 && (
                      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2 text-cyan-500">
                          <FiDownload className="w-5 h-5" />
                          <span>Downloaded</span>
                        </div>
                        {downloadStats.lastDownload && (
                          <p className="text-sm text-gray-500 mt-1">
                            Last download: {formatLastDownload(downloadStats.lastDownload)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'receive' && (
              <motion.div
                key="receive"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {!isOTPVerified && !passwordRequired ? (
                  <div className="mt-8">
                    <div className="mb-6">
                      <label htmlFor="receiveOtp" className="block text-lg text-gray-300 mb-2 text-center">
                        Enter One-Time Password
                      </label>
                      <div className="flex items-center justify-center">
                        <input
                          type="text"
                          id="receiveOtp"
                          maxLength={6}
                          pattern="\d{6}"
                          placeholder="000000"
                          className="w-[280px] text-center text-3xl tracking-[0.5em] font-mono bg-gray-800/50 text-cyan-500 p-4 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/50"
                          onChange={(e) => {
                            // Only allow numeric input
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            e.target.value = value;
                            if (value.length > 0) {
                              setActiveMode('receive');
                            } else {
                              setActiveMode('none');
                            }
                            setError('');
                          }}
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={handleReceive}
                      className="w-full py-3 rounded-lg font-medium bg-cyan-500 text-white hover:bg-cyan-600"
                    >
                      Access Files
                    </button>

                    {error && (
                      <div className="mt-4 text-red-400 text-sm text-center">
                        {error}
                      </div>
                    )}
                  </div>
                ) : passwordRequired ? (
                  <div className="mt-8">
                    <div className="mb-6">
                      <label htmlFor="receivePassword" className="block text-2xl font-bold text-cyan-400 mb-4 text-center">
                        Enter Password
                      </label>
                      <div className="flex items-center justify-center">
                        <input
                          type="password"
                          id="receivePassword"
                          placeholder=""
                          className="w-[280px] text-center text-lg bg-gray-800/50 text-cyan-500 p-4 rounded-lg outline-none border-2 border-gray-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={handlePasswordSubmit}
                      className="w-full py-3 rounded-lg font-medium bg-cyan-500 text-white hover:bg-cyan-600"
                    >
                      Submit Password
                    </button>

                    {error && (
                      <div className="mt-4 text-red-400 text-sm text-center">
                        {error}
                      </div>
                    )}
                  </div>
                ) : verifiedFiles.length > 0 && (
                  <div className="mt-8">
                    <div className="bg-gray-800 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                          <h3 className="text-lg text-cyan-500">Access Verified Successfully</h3>
                        </div>
                      </div>

                      <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-400">Total Size</p>
                            <p className="text-lg text-cyan-500 font-mono">
                              {formatBytes(verifiedFiles.reduce((total, file) => total + file.size, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Files</p>
                            <p className="text-lg text-cyan-500 font-mono text-center">
                              {verifiedFiles.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Security</p>
                            <div className="flex justify-center mt-1">
                              <FiLock className="text-green-500 w-5 h-5" />
                              <FiShield className="text-green-500 w-5 h-5 ml-1" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        {verifiedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <FiFile className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="overflow-hidden">
                                <p className="text-gray-300 text-sm font-medium truncate">{file.name}</p>
                                <p className="text-gray-400 text-xs">{formatBytes(file.size)}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownload({ name: file.name, size: file.size, id: file.id, index })}
                              className="ml-4 p-2 text-gray-400 hover:text-cyan-500 transition-colors flex-shrink-0"
                              title="Download file"
                            >
                              <FiDownload className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-4">
                        <button
                          onClick={handleDownloadAll}
                          className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium flex items-center justify-center"
                        >
                          <FiDownload className="w-5 h-5 mr-2" />
                          Download All Files
                        </button>

                        <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                          <div className="flex items-center">
                            <FiClock className="w-4 h-4 mr-1" />
                            <span>Expires in 24 hours</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
