import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-mark">EM</div>
            <div>
              <p className="brand">Encrypted Media Vault</p>
              <p className="tagline">Store IPFS pointers with client-side encryption + Zama FHE</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
