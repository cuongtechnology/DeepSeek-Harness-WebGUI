import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DeepSeek Harness WebGUI',
  description: 'A self-hosted web control plane for AI coding agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">{children}</body>
    </html>
  );
}
