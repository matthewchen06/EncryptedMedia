# Encrypted Media Vault

Encrypted Media Vault is a privacy-first media indexer that stores only encrypted references on-chain. The app
creates a pseudo IPFS hash locally, encrypts it with a randomly generated EVM address, then protects that
address using Zama FHE before saving the metadata on-chain. Media stays off-chain; the chain stores encrypted
pointers and access control.

## Why This Project
Sharing or archiving private media usually means trusting a storage provider, or exposing metadata on-chain.
This project addresses those gaps by:
- Keeping media off-chain while still providing verifiable on-chain records.
- Encrypting the reference (pseudo IPFS hash) so on-chain data is opaque to observers.
- Using FHE to protect the encryption key (random EVM address) without revealing it publicly.

## Core Capabilities
- Local media selection for images and videos.
- Pseudo IPFS hash generation (no real upload) to keep the flow fast and deterministic.
- Random EVM address generation to serve as the encryption key container.
- On-chain storage of file name, encrypted hash, and FHE-encrypted address.
- Retrieval of stored records and controlled decryption flow to recover the original hash.
- Deterministic, explicit read APIs that do not rely on `msg.sender` in view functions.

## End-to-End Flow
1. User selects a media file (image or video).
2. A pseudo IPFS hash is generated locally.
3. A random EVM address A is generated locally.
4. The hash is encrypted using A, producing an encrypted hash.
5. Address A is encrypted via Zama FHE.
6. File name, encrypted hash, and FHE-encrypted address are stored on-chain.
7. When the user requests access, address A is decrypted and used to recover the original hash.

## Advantages
- Privacy by design: no raw media or plaintext hashes stored on-chain.
- Minimal on-chain footprint: only encrypted metadata is stored.
- Access control: sharing is done explicitly at the contract level.
- Deterministic UI flow: no mock data and no local storage dependencies.
- Clear separation of concerns: read operations via viem, write operations via ethers.

## Tech Stack
- Smart contracts: Hardhat
- FHE: Zama contracts and relayer integration
- Frontend: React + Vite
- Ethereum tooling: viem (reads) and ethers (writes)
- Networks: Sepolia
- Package manager: npm

## Repository Structure
- `contracts/`: Solidity smart contracts
- `deploy/`: Deployment scripts
- `tasks/`: Hardhat tasks
- `test/`: Contract tests
- `frontend/`: React + Vite frontend
- `deployments/`: Deployed contract artifacts and ABIs
- `docs/`: Zama documentation and relayer notes

## Smart Contract Summary
Core behaviors:
- Store media metadata with encrypted references.
- Track per-owner media lists without relying on `msg.sender` for views.
- Grant access to decrypt the protected address when needed.

Important contracts and concepts:
- `saveMedia`: Stores file name, encrypted hash, and FHE-encrypted address.
- `grantDecryptionAccess`: Grants FHE access to a specific address.
- `listMedia` / `getMedia`: Read-only accessors keyed by explicit owner.

Custom errors:
- `EmptyFileName`
- `EmptyEncryptedCid`
- `InvalidRecordIndex`
- `UnauthorizedShare`

Events:
- `MediaStored`
- `SecretAddressAccessGranted`

## Frontend Summary
- Reads use viem for efficient queries.
- Writes use ethers to submit transactions.
- ABI is sourced from `deployments/sepolia/EncryptedMedia.json`.
- UI provides full flow: select, encrypt, store, list, decrypt.
- No Tailwind; styles are handled with standard CSS.

## Setup and Usage

### Prerequisites
- Node.js 20+
- npm

### Install Dependencies
```bash
npm install
```

### Configure Environment
Create a `.env` file with the following values:
```bash
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=optional_for_verification
```

### Compile and Test
```bash
npm run compile
npm run test
```

### Deploy
```bash
# Deploy to a local node if needed
npx hardhat node
npx hardhat deploy --network localhost

# Deploy to Sepolia once tests pass
npx hardhat deploy --network sepolia
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Security and Privacy Notes
- Only encrypted metadata is stored on-chain.
- The pseudo IPFS hash is generated locally; no real upload is required.
- The encryption address is protected by FHE and never revealed publicly.
- The frontend does not depend on local storage for user data.

## Limitations
- This project stores encrypted references, not the media itself.
- The pseudo IPFS hash is random and does not verify real content.
- Access control is scoped to the chain; off-chain sharing requires coordination.

## Roadmap
- Add support for real IPFS uploads while preserving the encryption model.
- Add batch upload and batch decrypt operations.
- Improve media previews with streamed decryption flow.
- Expand access control to group-based permissions.
- Add analytics for on-chain usage without leaking metadata.

## FAQ
**Why a pseudo IPFS hash?**
It keeps the demo self-contained and avoids network dependencies while preserving the flow of encrypted pointers.

**Does the chain ever see the real hash?**
No. The hash is encrypted locally, and the encryption key is itself protected with FHE.

**Where is the ABI sourced from?**
From `deployments/sepolia/EncryptedMedia.json`.

## License
See `LICENSE`.
