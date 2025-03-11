import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { Metadata } from 'next';
import { initializeDatabase } from '@/lib/db-init';

// Initialize database when the app starts
initializeDatabase().catch(console.error);

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Blizz Share - Next-generation secure file sharing',
  description: 'Share files securely with end-to-end encryption, auto-expiry, and no account required',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
