import { tokenManager, wagmiConfig } from "@gaiaprotocol/client-common";
import { getAccount } from "@wagmi/core";

export function getMyAddress(): `0x${string}` | null {
  return (tokenManager.getAddress() as `0x${string}` | null)
    ?? (getAccount(wagmiConfig).address as `0x${string}` | null)
    ?? null;
}
