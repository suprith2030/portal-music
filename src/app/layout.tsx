import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PORTAL // AUDIO OS',
  description:
    'A Y2K retro-futuristic cyber-terminal audio player — cloud-powered by Supabase + Cloudflare R2.',
  keywords: ['audio', 'player', 'portal', 'synthwave', 'music', 'streaming', 'audio os'],
  openGraph: {
    title: 'PORTAL // AUDIO OS',
    description: 'True game-changing cyber-terminal audio system.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#463DF5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#1a1046] text-white">{children}</body>
    </html>
  );
}
