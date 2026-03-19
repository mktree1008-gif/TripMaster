import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TripMaster',
  description: 'Trip planning and diary all-in-one web app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
