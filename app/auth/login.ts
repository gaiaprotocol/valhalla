import { getAccount } from '@wagmi/core';
import { wagmiConfig } from './wallet';

async function requestLogin(signature: string): Promise<string> {
  const address = getAccount(wagmiConfig).address;
  if (!address) throw new Error('No wallet connected');

  const response = await fetch(
    '/api/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
      }),
    },
  );
  if (!response.ok) throw new Error('Failed to login');
  const data = await response.json();
  if (!data.token) throw new Error('Invalid response from server');

  return data.token;
}

export { requestLogin };
