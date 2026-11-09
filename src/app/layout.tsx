import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Web3 Lead Hunter',
  description: 'Automated Web3 project discovery and human-reviewed client prospecting.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
