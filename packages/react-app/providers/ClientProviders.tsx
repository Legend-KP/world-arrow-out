'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const AppProvider = dynamic(
  () => import('@/providers/AppProvider').then((mod) => mod.AppProvider),
  { ssr: false }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
