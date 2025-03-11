import React, { useState } from 'react';
import { formatFileSize } from '@/lib/utils';
import styles from './FileReceiver.module.css';

interface FileReceiverProps {
  fileId: string;
}

interface FileDetails {
  name: string;
  size: number;
}

const FileReceiver: React.FC<FileReceiverProps> = ({ fileId }) => {
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setVerified(true);
      setFileDetails(data.file);
      setPasswordRequired(data.passwordRequired);

      if (!data.passwordRequired) {
        getDownloadUrl();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const getDownloadUrl = async () => {
    setIsDownloading(true);
    setError('');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, otp, password }),
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the password');
      return;
    }
    getDownloadUrl();
  };

  const downloadFile = () => {
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className={styles.container}>
      {!verified ? (
        <>
          <div className={styles.branding}>Blizz Share</div>
          <div className={styles.card}>
            <h2>Enter OTP to access files</h2>
            <p>The sender has shared files with you securely.</p>
            <div className={styles.otpContainer}>
              <input
                type="text"
                value={otp}
                onChange={handleOtpChange}
                placeholder="123456"
                className={styles.otpInput}
                maxLength={6}
                autoFocus
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button
              onClick={verifyOtp}
              disabled={isVerifying || otp.length !== 6}
              className={styles.button}
            >
              {isVerifying ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </>
      ) : passwordRequired && !downloadUrl ? (
        <div className={styles.card}>
          <h2>Password Protected</h2>
          <p>This file requires a password to access.</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.passwordInput}
              autoFocus
            />
            {error && <div className={styles.error}>{error}</div>}
            <button
              type="submit"
              disabled={isDownloading}
              className={styles.button}
            >
              {isDownloading ? 'Verifying...' : 'Submit'}
            </button>
          </form>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.successHeader}>Access Verified Successfully</div>
          <div className={styles.fileDetails}>
            <h3>File Details</h3>
            <div className={styles.fileInfo}>
              <p>
                <strong>Name:</strong> {fileDetails?.name}
              </p>
              <p>
                <strong>Size:</strong> {fileDetails ? formatFileSize(fileDetails.size) : ''}
              </p>
            </div>
            {downloadUrl ? (
              <button onClick={downloadFile} className={styles.downloadButton}>
                Download File
              </button>
            ) : (
              <div className={styles.loading}>Preparing download link...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileReceiver;
