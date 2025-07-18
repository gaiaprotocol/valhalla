import { getDefaultWallets } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import App from './app.tsx'
import './index.css'

const queryClient = new QueryClient();

// wagmi + rainbowkit 최신 설정
const { connectors } = getDefaultWallets({
  appName: 'Valhalla',
  projectId: '9a637488c787c2c68339c70e1319ac6a',
});

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(), // RPC를 설정
  },
  connectors,
  ssr: false, // (선택) SSR 사용하지 않을 경우
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <App />
      </WagmiProvider>
    </QueryClientProvider>
  </StrictMode>,
)
