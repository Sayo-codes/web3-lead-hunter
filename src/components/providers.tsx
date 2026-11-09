'use client';

import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { fetcher } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 3000 }}>
      {children}
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </SWRConfig>
  );
}
