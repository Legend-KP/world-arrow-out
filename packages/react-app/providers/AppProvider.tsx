'use client';

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';

import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ??
  process.env.WC_PROJECT_ID ??
  '044601f65212332475a09bc14ceb3c34';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet],
    },
  ],
  {
    appName: 'Celo Composer',
    projectId: walletConnectProjectId,
  }
);

const config = createConfig({
  connectors,
  chains: [celo, celoAlfajores],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
});

const queryClient = new QueryClient();

const Web3Provider = WagmiProvider as React.ComponentType<
  React.PropsWithChildren<{ config: typeof config }>
>;

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </Web3Provider>
  );
}
