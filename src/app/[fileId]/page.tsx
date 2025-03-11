"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FiCheckCircle, FiFile, FiArchive, FiClock, FiDownload, FiEye, FiEyeOff } from 'react-icons/fi';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { openDB, IDBPDatabase } from 'idb';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import ClipboardIcon from '../../components/ClipboardIcon';

interface BlizzDB extends IDBPDatabase {
  files: {
    key: string;
    value: Blob;
  };
}

interface FileDetails {
  totalFiles: number;
  fileName: string;
  fileSize: number;
  expiry: string;
  password: boolean;
  downloadCount: number;
}

export default function FileReceiver({ params }: { params: { fileId: string } }) {
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [completeFileData, setCompleteFileData] = useState<any>(null);
  const [directAccess, setDirectAccess] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadSessionId, setDownloadSessionId] = useState<string | null>(null);

  // Function to load file details
  const loadFileDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/file-exists?fileId=${params.fileId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load file details');
      }

      if (data.exists) {
        // Format expiry time
        const expiry = data.expiresAt || '';
        
        setFileDetails({
          totalFiles: data.totalFiles || 1,
          fileName: data.fileName,
          fileSize: data.fileSize,
          expiry: expiry,
          password: data.password || false,
          downloadCount: data.downloadCount || 0
        });
      } else {
        setError('File not found or has expired');
      }
    } catch (err: any) {
      console.error('Error loading file details:', err);
      setError(err.message || 'Failed to load file details');
    } finally {
      setLoading(false);
    }
  };

  // Validate fileId format
  useEffect(() => {
    if (!/^[A-Za-z0-9]{6}$/.test(params.fileId)) {
      setError('Invalid file link');
      return;
    }
    
    // Load file details on initial load
    loadFileDetails();
  }, [params.fileId]);

  // Auto-verify OTP if it's already in localStorage
  useEffect(() => {
    const autoVerifyOtp = async () => {
      try {
        // Check if this is a direct access from the Receive Files tab
        const isDirectAccess = localStorage.getItem(`blizz-direct-access-${params.fileId}`) === 'true';
        const isVerifiedOtp = localStorage.getItem(`blizz-verified-otp-${params.fileId}`) === 'true';
        
        setDirectAccess(isDirectAccess);
        
        // If direct access or verified OTP, skip the OTP verification screen
        if (isDirectAccess || isVerifiedOtp) {
          const storedOtp = localStorage.getItem(`blizz-otp-${params.fileId}`);
          if (storedOtp && /^\d{6}$/.test(storedOtp)) {
            // Skip the OTP verification screen entirely
            setOtp(storedOtp);
            setOtpVerified(true);
            
            // Load file details immediately
            await loadFileDetails();
            
            setSuccessMessage('OTP verified successfully');
            
            // Clear the direct access flag after use
            localStorage.removeItem(`blizz-direct-access-${params.fileId}`);
            localStorage.removeItem(`blizz-verified-otp-${params.fileId}`);
          }
        }
      } catch (error) {
        console.error('Error auto-verifying OTP:', error);
        setError(error instanceof Error ? error.message : 'Error verifying OTP');
      }
    };
    
    autoVerifyOtp();
  }, [params.fileId]);

  // Function to verify OTP
  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp, fileId: params.fileId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OTP verification failed');
      }

      // OTP verified successfully
      setOtpVerified(true);
      setSuccessMessage('Access Verified Successfully');
      
      // Set file details
      setFileDetails({
        totalFiles: 1,
        fileName: data.file.name,
        fileSize: data.file.size,
        expiry: data.expiry || '',
        password: data.password || false,
        downloadCount: data.downloadCount || 0
      });
      
      // Check if password is required
      setPasswordRequired(data.passwordRequired);
      
      // If no password required, get download URL
      if (!data.passwordRequired) {
        getDownloadUrl();
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial metadata loading
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        // Validate fileId format first
        if (!/^[A-Za-z0-9]{6}$/.test(params.fileId)) {
          setError('Invalid file link');
          return;
        }

        // Check IndexedDB first
        const db = await openDB<BlizzDB>('blizz-share', 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('files')) {
              db.createObjectStore('files');
            }
          },
        });

        // Check if file exists in IndexedDB
        const fileKey = `${params.fileId}-0`;
        const fileExists = await db.get('files', fileKey);
        
        // Then check metadata
        const metadataStr = localStorage.getItem(`blizz-meta-${params.fileId}`);
        if (!metadataStr) {
          setError('File not found or has expired');
          return;
        }

        const metadata = JSON.parse(metadataStr);
        const expiryDate = new Date(new Date(metadata.createdAt).getTime() + (24 * 60 * 60 * 1000));
        const now = new Date();
        
        if (now > expiryDate) {
          // Clean up expired data
          localStorage.removeItem(`blizz-meta-${params.fileId}`);
          localStorage.removeItem(`blizz-otp-${params.fileId}`);
          localStorage.removeItem(`blizz-pwd-${params.fileId}`);
          await db.delete('files', fileKey);
          setError('This link has expired');
          return;
        }

        if (!fileExists) {
          setError('File data not found. Please try uploading again.');
          return;
        }

        setFileDetails({
          totalFiles: metadata.totalFiles,
          fileName: metadata.fileName,
          fileSize: metadata.fileSize,
          expiry: metadata.expiry,
          password: metadata.password,
          downloadCount: metadata.downloadCount || 0
        });

        // Check if password is required
        const hasPassword = !!localStorage.getItem(`blizz-pwd-${params.fileId}`);
        setPasswordRequired(hasPassword);

      } catch (error) {
        console.error('Error loading metadata:', error);
        setError('Failed to load file information');
      }
    };

    loadMetadata();
  }, [params.fileId]);

  // Format expiry time
  const formatExpiry = (expiry: string) => {
    return expiry;
  };

  // Update expiry time every minute
  useEffect(() => {
    // No need to update timer if file details aren't loaded yet
    if (!fileDetails) return;
    
    // Update timer every minute
    const timer = setInterval(() => {
      // Just trigger a re-render to update the formatted expiry
      setFileDetails({...fileDetails});
    }, 60000);
    
    return () => clearInterval(timer);
  }, [fileDetails]);

  const verifyPassword = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!password.trim()) {
        setError('Please enter a password');
        return;
      }
      
      // Call the API to verify password and get download URL
      await getDownloadUrl();
      
      // If we reach here, password is correct
      setPasswordVerified(true);
    } catch (err: any) {
      console.error('Error verifying password:', err);
      setError(err.message || 'Invalid password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    try {
      // Prevent multiple clicks
      if (loading) return;
      
      setLoading(true);
      setError('');
      
      if (!downloadUrl) {
        throw new Error('Download URL not available');
      }
      
      // Track download in MongoDB
      try {
        const response = await fetch('/api/track-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId: params.fileId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // Update the UI with the new download count
          if (fileDetails) {
            setFileDetails({
              ...fileDetails,
              downloadCount: data.downloadCount
            });
          }
        }
      } catch (err) {
        console.error('Error tracking download:', err);
      }
      
      // Open the download URL in a new tab
      window.open(downloadUrl, '_blank');
      
      setSuccessMessage('File download initiated!');
    } catch (err: any) {
      console.error('Error downloading file:', err);
      setError(err.message || 'Failed to download file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

  const truncateFileName = (fileName: string, maxLength: number = 30) => {
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - 4) + '...';
    return `${truncatedName}.${extension}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  const copyOTP = () => {
    navigator.clipboard.writeText(otp);
  };

  useEffect(() => {
    setShareLink(`${window.location.origin}/${params.fileId}`);
  }, [params.fileId]);

  // Function to get download URL without tracking downloads
  const getDownloadUrl = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fileId: params.fileId, 
          otp, 
          password: passwordRequired ? password : undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.passwordRequired) {
          setPasswordRequired(true);
          throw new Error('Password required for this file');
        }
        throw new Error(data.error || 'Download failed');
      }

      setDownloadUrl(data.downloadUrl);
      setSuccessMessage('Access Verified Successfully');
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to get download URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start p-4">
      {/* Only show branding before OTP verification */}
      {!otpVerified && (
        <div className="w-full max-w-md mb-8">
          <div className="flex flex-col items-center">
            <div className="bg-gray-900/[0.07] rounded-sm px-1.5 py-0.5">
              <div className="flex items-center">
                <span className="text-2xl font-bold text-white leading-none">blizz</span>
                <div className="w-0.5 h-0.5 bg-blue-500 rounded-full mx-0.5"></div>
                <span className="text-2xl font-bold text-gray-300 leading-none">share</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-3">Next-generation secure file sharing</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 rounded-lg shadow-lg p-6">
          {error && (
            <div className="mb-6 text-red-500 text-center bg-red-500/10 p-3 rounded">
              {error}
            </div>
          )}
          {!otpVerified ? (
            <div className="flex flex-col items-center">
              <div className="lightning-container mb-8">
                <h2 className="text-xl text-gray-300 text-center">Enter the OTP to access this file</h2>
              </div>
              <div className="w-full mb-8">
                <div className="flex justify-center mb-2 tracking-[0.5em]">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength={1}
                      value={otp[i] || ''}
                      onChange={(e) => {
                        const newOtp = otp.split('');
                        newOtp[i] = e.target.value.replace(/[^0-9]/g, '');
                        setOtp(newOtp.join(''));
                        if (e.target.value && i < 5) {
                          const nextInput = document.querySelector(`input[data-index="${i + 1}"]`);
                          if (nextInput) (nextInput as HTMLInputElement).focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) {
                          const prevInput = document.querySelector(`input[data-index="${i - 1}"]`);
                          if (prevInput) (prevInput as HTMLInputElement).focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(pastedData);
                        if (pastedData.length === 6) {
                          const lastInput = document.querySelector(`input[data-index="5"]`);
                          if (lastInput) (lastInput as HTMLInputElement).focus();
                        }
                      }}
                      data-index={i}
                      className="w-12 h-16 mx-0 bg-gray-700/30 rounded text-center text-3xl font-mono text-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 caret-transparent selection:bg-transparent"
                      autoFocus={i === 0}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      pattern="[0-9]*"
                    />
                  ))}
                </div>
                <p className="text-gray-400 text-xs text-center mt-1">Enter the 6-digit OTP code</p>
              </div>
              <button
                onClick={verifyOtp}
                disabled={otp.length !== 6 || loading}
                className={`w-full bg-cyan-500 text-gray-900 px-6 py-4 rounded-lg font-medium transition-colors ${
                  otp.length === 6 && !loading ? 'hover:bg-cyan-400' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                {loading ? 'Verifying...' : 'Access Files'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {successMessage && (
                <div className="bg-green-500/20 text-green-400 p-4 rounded-lg text-center mb-6">
                  <div className="flex items-center justify-center">
                    <FiCheckCircle className="w-5 h-5 mr-2" />
                    {successMessage}
                  </div>
                </div>
              )}

              {passwordRequired && !passwordVerified ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-md mb-6">
                    <div className="flex flex-col items-center">
                      <div className="bg-gray-900/[0.07] rounded px-2 py-0.5">
                        <div className="flex items-center">
                          <span className="text-2xl font-bold text-white leading-none">blizz</span>
                          <div className="w-0.5 h-0.5 bg-blue-500 rounded-full mx-0.5"></div>
                          <span className="text-2xl font-bold text-gray-300 leading-none">share</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs text-center mt-2">Next-generation secure file sharing</p>
                    </div>
                  </div>
                  <h2 className="text-xl text-gray-300 mb-4">Password Required</h2>
                  <div className="w-full mb-4">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full bg-gray-700/50 text-gray-300 px-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-12"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && password) {
                            verifyPassword();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={verifyPassword}
                    disabled={!password || loading}
                    className={`w-full bg-cyan-500 text-gray-900 px-6 py-4 rounded-lg font-medium transition-colors ${
                      password && !loading ? 'hover:bg-cyan-400' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {loading ? 'Verifying...' : 'Verify Password'}
                  </button>
                </div>
              ) : (
                fileDetails && (
                  <div className="space-y-4">
                    {/* Add Blizz Share branding at the top of file details */}
                    <div className="flex flex-col items-center mb-6">
                      <div className="bg-gray-900/[0.07] rounded px-2 py-0.5">
                        <div className="flex items-center">
                          <span className="text-2xl font-bold text-white leading-none">blizz</span>
                          <div className="w-0.5 h-0.5 bg-blue-500 rounded-full mx-0.5"></div>
                          <span className="text-2xl font-bold text-gray-300 leading-none">share</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs text-center mt-2">Next-generation secure file sharing</p>
                    </div>
                    
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <h3 className="text-lg text-gray-300 mb-4">File Details</h3>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <FiFile className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                          <span className="text-gray-300 truncate">{fileDetails.fileName}</span>
                        </div>
                        <span className="text-gray-400 text-sm flex-shrink-0 ml-3">
                          {formatBytes(fileDetails.fileSize)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700/30 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FiArchive className="w-4 h-4 text-cyan-500" />
                          <span className="text-gray-400 text-sm">Total Size</span>
                        </div>
                        <div className="text-gray-300 mt-1 font-medium">
                          {formatBytes(fileDetails.fileSize)}
                        </div>
                      </div>

                      <div className="bg-gray-700/30 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FiClock className="w-4 h-4 text-cyan-500" />
                          <span className="text-gray-400 text-sm">Expires in</span>
                        </div>
                        <div className="text-gray-300 mt-1 font-mono tracking-[0.15em] text-base">
                          {formatExpiry(fileDetails.expiry)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={downloadFile}
                      disabled={loading}
                      className={`w-full bg-cyan-500 text-gray-900 px-6 py-4 rounded-lg font-medium transition-colors flex items-center justify-center mt-6 ${
                        loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-400'
                      }`}
                    >
                      <FiDownload className="w-5 h-5 mr-2" />
                      {loading ? 'Downloading...' : 'Download Files'}
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
