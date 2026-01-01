import './globals.css';
import { Providers } from '@/components/Providers';
import { JetBrains_Mono, Inter } from 'next/font/google';

// Optimized font loading with next/font - eliminates render-blocking external fonts
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'PEDIASENSE NestWatch | NICU Monitoring',
  description: 'Real-time multi-patient vital signs monitoring dashboard for Neonatal ICU by PEDIASENSE',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/branding/nestwatch-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/branding/nestwatch-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [
      { url: '/branding/nestwatch-128.png', sizes: '128x128' },
      { url: '/branding/nestwatch-256.png', sizes: '256x256' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="antialiased bg-[#000508] text-white font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
