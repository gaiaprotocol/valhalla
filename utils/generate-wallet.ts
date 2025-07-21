import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

async function main() {
  // 비밀키 생성
  const privateKey = generatePrivateKey();
  console.log('Private Key:', privateKey);

  // 계정 객체 생성
  const account = privateKeyToAccount(privateKey);
  console.log('Address:', account.address);
}

main();
