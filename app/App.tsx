import { RainbowKitAuthenticationProvider, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import authenticationAdapter from "./lib/auth";
import LoginPage from "./login";

function App() {
  const AUTHENTICATION_STATUS = 'loading';

  return (
    <RainbowKitAuthenticationProvider
      adapter={authenticationAdapter}
      status={AUTHENTICATION_STATUS}
    >
      <RainbowKitProvider>
        <LoginPage />
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  );
}

export default App;