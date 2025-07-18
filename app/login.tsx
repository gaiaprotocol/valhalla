import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* 로고 영역 */}
          <div className="text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <div className="text-4xl font-bold text-white">W3</div>
            </div>
            <h1 className="text-3xl font-bold text-white">Web3 App</h1>
            <p className="mt-2 text-slate-300">블록체인 기반 애플리케이션</p>
          </div>

          {/* 지갑 연결 컴포넌트 */}
          <ConnectButton />

          {/* 추가 정보 */}
          <div className="text-center text-sm text-slate-400">
            <p>지원되는 지갑: MetaMask, WalletConnect, Coinbase Wallet 등</p>
          </div>
        </div>
      </div>
    </div>
  )
}
