"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiShare2, FiCopy, FiLock, FiDownload, FiClock, FiInfo } from 'react-icons/fi';
import BlizzShareLogo from '@/components/BlizzShareLogo';
import QRCode from 'qrcode.react';
import Link from 'next/link';

export default function ShareFiles() {
  const [shareUrl, setShareUrl] = useState('');
  const [otp, setOtp] = useState('');
  const [copied, setCopied] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(0);
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(false);
  const [accessHistory, setAccessHistory] = useState<{type: string; timestamp: string}[]>([]);

  useEffect(() => {
    // Get the share URL and OTP from localStorage
    const storedShareUrl = localStorage.getItem('shareUrl');
    const storedOtp = localStorage.getItem('otp');
    if (storedShareUrl) {
      setShareUrl(storedShareUrl);
      // Get file ID from URL
      const fileId = storedShareUrl.split('/').pop();
      if (fileId) {
        // Get metadata for download count
        const metadataStr = localStorage.getItem(`blizz-meta-${fileId}`);
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          setDownloadCount(metadata.downloadCount || 0);
        }
        
        // Get notification status
        const notifyStatus = localStorage.getItem(`blizz-notify-${fileId}`);
        setNotifyEnabled(notifyStatus === 'true');
        
        // Get access history if notifications are enabled
        if (notifyStatus === 'true') {
          const statsKey = `blizz-stats-${fileId}`;
          const statsStr = localStorage.getItem(statsKey);
          if (statsStr) {
            try {
              const stats = JSON.parse(statsStr);
              if (stats.accessHistory && Array.isArray(stats.accessHistory)) {
                setAccessHistory(stats.accessHistory);
              }
            } catch (e) {
              console.error('Error parsing stats:', e);
            }
          }
        }
      }
    }
    if (storedOtp) setOtp(storedOtp);
  }, []);

  useEffect(() => {
    if (!shareUrl) return;
    
    const fileId = shareUrl.split('/').pop();
    if (!fileId) return;
    
    const checkUpdates = () => {
      // Check metadata for download count
      const metadataStr = localStorage.getItem(`blizz-meta-${fileId}`);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        setDownloadCount(metadata.downloadCount || 0);
      }
      
      // Check notification status
      const notifyStatus = localStorage.getItem(`blizz-notify-${fileId}`);
      setNotifyEnabled(notifyStatus === 'true');
      
      // Check access history if notifications are enabled
      if (notifyStatus === 'true') {
        const statsKey = `blizz-stats-${fileId}`;
        const statsStr = localStorage.getItem(statsKey);
        if (statsStr) {
          try {
            const stats = JSON.parse(statsStr);
            if (stats.accessHistory && Array.isArray(stats.accessHistory)) {
              setAccessHistory(stats.accessHistory);
            }
          } catch (e) {
            console.error('Error parsing stats:', e);
          }
        }
      }
    };
    
    // Check initially
    checkUpdates();
    
    // Set up interval to check every 5 seconds
    const interval = setInterval(checkUpdates, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [shareUrl]);

  const copyToClipboard = async (text: string, isOtp: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isOtp) {
        setOtpCopied(true);
        setTimeout(() => setOtpCopied(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyOTP = () => {
    copyToClipboard(otp, true);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-6">
        <BlizzShareLogo className="mx-auto mb-6" />
        
        <div className="flex justify-center mb-8 w-full">
          <nav className="w-full grid grid-cols-3 text-sm">
            <Link href="/" className="text-gray-400 hover:text-gray-300 px-1 pb-2">
              Upload
            </Link>
            <div className="relative">
              <Link href="/share" className="text-cyan-400 px-1 pb-2 block">
                Share
              </Link>
              <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-cyan-400" />
            </div>
            <Link href="/receive" className="text-gray-400 hover:text-gray-300 px-1 pb-2">
              Receive
            </Link>
          </nav>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {shareUrl ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-gray-300 text-sm font-normal">Share Link</h2>
                  <div className="px-2 py-0.5 bg-gray-700/50 rounded-md text-xs text-cyan-400 flex items-center">
                    <FiDownload className="w-3 h-3 mr-1.5" />
                    <span className="font-mono">{downloadCount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="bg-gray-700/50 rounded-lg flex items-center w-full max-w-[280px]">
                    <div className="text-gray-300 font-mono text-sm truncate px-4 py-2.5">
                      {shareUrl}
                    </div>
                    <button
                      onClick={() => copyToClipboard(shareUrl)}
                      className="text-gray-400 hover:text-gray-300 p-2.5 flex-shrink-0 border-l border-gray-600"
                      aria-label="Copy share link"
                    >
                      <FiCopy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-gray-300 text-sm font-normal mb-4">One-Time Password</h2>
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-gray-800/50 rounded-lg py-4 px-8">
                    <div className="flex items-center">
                      <div className="tracking-[0.75em] pr-[0.75em]">
                        {otp.split('').map((digit, i) => (
                          <span key={i} className="text-4xl text-cyan-400 font-mono">
                            {digit}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={copyOTP}
                        className="text-gray-400 hover:text-gray-300 ml-2"
                        aria-label="Copy OTP"
                      >
                        <FiCopy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-gray-300 text-sm font-normal mb-4">QR Code</h2>
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg inline-flex">
                    <QRCode 
                      value={shareUrl}
                      size={160}
                      level="H"
                      renderAs="svg"
                      includeMargin={false}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-gray-400 text-sm">
                  <div className="flex items-center space-x-2">
                    <FiClock className="w-4 h-4 text-cyan-500" />
                    <span>Expires in 24 hours</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiDownload className="w-4 h-4 text-cyan-500" />
                    <span>Downloads: {downloadCount}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-gray-400 text-sm">
                  <div className="flex items-center space-x-2">
                    <FiInfo className="w-4 h-4 text-cyan-500" />
                    <span>Notify on Access:</span>
                  </div>
                  <div>
                    <span className="px-2 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400">
                      {notifyEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                
                {/* Show access history when notifications are enabled */}
                {notifyEnabled && (
                  <div className="mt-4 bg-gray-800/50 rounded-lg p-3">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Access Notifications</h3>
                    
                    {/* Download count summary */}
                    <div className="mb-3 py-2 px-3 bg-gray-700/30 rounded flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FiDownload className="w-4 h-4 text-cyan-500" />
                        <span className="text-gray-300">Total Downloads</span>
                      </div>
                      <span className="text-cyan-400 font-mono text-lg">{downloadCount}</span>
                    </div>
                    
                    {/* Download history */}
                    {accessHistory.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {accessHistory.map((access, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <FiDownload className="w-3 h-3 text-cyan-500" />
                              <span className="text-gray-400">File downloaded</span>
                            </div>
                            <span className="text-gray-500">
                              {new Date(access.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-2">
                        No downloads yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-gray-300">No active share found</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
