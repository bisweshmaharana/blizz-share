"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import FileUploader from '@/components/FileUploader';
import FeatureCard from '@/components/FeatureCard';
import { FiLock, FiClock, FiShield, FiCopy } from 'react-icons/fi';
import BlizzShareLogo from '@/components/BlizzShareLogo';
import Link from 'next/link';
import QRCode from 'react-qr-code';

export default function Home() {
  // Set dark mode permanently
  useEffect(() => {
    // Apply dark mode
    document.documentElement.classList.add('dark');
  }, []);

  const [selectedTab, setSelectedTab] = useState<'upload' | 'share' | 'receive'>('upload');
  const [shareLink, setShareLink] = useState<string>('');
  const [otp, setOtp] = useState<string>('');

  useEffect(() => {
    // Check if there's a share link in localStorage
    const storedShareUrl = localStorage.getItem('shareUrl');
    if (storedShareUrl) setShareLink(storedShareUrl);

    // Check if there's an OTP in localStorage
    const storedOtp = localStorage.getItem('otp');
    if (storedOtp) setOtp(storedOtp);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-200 to-dark-300 transition-colors duration-300">
      <div className="container mx-auto px-4 py-16 relative z-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <BlizzShareLogo className="transform scale-150" />
          </div>
          <p className="text-xl md:text-2xl text-gray-300">
            Next-generation secure file sharing
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <FileUploader />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto"
        >
          <FeatureCard 
            icon={<FiLock className="w-8 h-8" />}
            title="End-to-End Encryption"
            description="Your files are encrypted before upload"
          />
          <FeatureCard 
            icon={<FiClock className="w-8 h-8" />}
            title="24-Hour Storage"
            description="Files auto-delete after 24 hours"
          />
          <FeatureCard 
            icon={<FiShield className="w-8 h-8" />}
            title="Secure Transfer"
            description="Advanced security features"
          />
          <FeatureCard 
            icon={<FiCopy className="w-8 h-8" />}
            title="5GB Daily Limit"
            description="Transfer up to 5GB per day"
          />
        </motion.div>
      </div>
    </div>
  );
}
