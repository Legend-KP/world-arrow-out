'use client';

import type { ReactNode } from 'react';

import { AppProvider } from '@/providers/AppProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
