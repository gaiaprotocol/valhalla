import { disconnect } from "@wagmi/core";
import { TokenManager } from "./token";
import { wagmiConfig } from "./wallet";

async function logout() {
  TokenManager.clear();
  await disconnect(wagmiConfig);
}

export { logout };
