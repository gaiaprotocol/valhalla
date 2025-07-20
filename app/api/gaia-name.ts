import { getAddress } from 'viem';

declare const GAIA_API_URI: string;

async function fetchGaiaNames(
  addresses: string[],
  nameMap: Map<string, string>,
  list: HTMLElement,
) {
  const res = await fetch(`${GAIA_API_URI}/get-names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses })
  });
  if (!res.ok) return;

  const names: { address: string; name: string }[] = await res.json();
  names.forEach(({ address, name }) => {
    address = getAddress(address);
    nameMap.set(address, name);
    // 기존 메시지 업데이트
    const nodes = list.querySelectorAll<HTMLElement>(`.message .name[data-account="${address}"]`);
    nodes.forEach(node => { node.textContent = name });
  });
}

export { fetchGaiaNames };
