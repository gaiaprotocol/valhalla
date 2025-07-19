import { getAddress } from 'viem';
import { z } from 'zod';
import { isHolder } from "../services/nft";

const GOD_NFT_CONTRACT = '0x134590ACB661Da2B318BcdE6b39eF5cF8208E372';

export async function handleGodModeCheck(request: Request): Promise<Response> {
  const schema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  });

  const { address } = schema.parse(await request.json());

  const normalizedAddress = getAddress(address);
  const holder = await isHolder(normalizedAddress, GOD_NFT_CONTRACT);

  return Response.json({ godMode: holder });
}
