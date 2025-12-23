import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Encrypted Media Vault',
  projectId: 'b1c4d55d7bf4450aa9bb4cc9b2f2f17e',
  chains: [sepolia],
  ssr: false,
});
