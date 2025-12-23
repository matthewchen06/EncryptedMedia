import { getBytes, hexlify, keccak256, toUtf8Bytes } from 'ethers';

const IPFS_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function generatePseudoIpfsHash(seed: string) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const seedBytes = toUtf8Bytes(seed);
  for (let i = 0; i < seedBytes.length; i += 1) {
    randomBytes[i % randomBytes.length] ^= seedBytes[i];
  }

  let output = 'Qm';
  for (let i = 0; i < 44; i += 1) {
    const index = randomBytes[i % randomBytes.length] % IPFS_ALPHABET.length;
    output += IPFS_ALPHABET[index];
  }
  return output;
}

export function encryptCidWithAddress(cid: string, address: string) {
  const cidBytes = toUtf8Bytes(cid);
  const key = getBytes(keccak256(address));
  const encrypted = cidBytes.map((byte, idx) => byte ^ key[idx % key.length]);
  return hexlify(encrypted);
}

export function decryptCidWithAddress(encryptedCid: string, address: string) {
  const cipherBytes = getBytes(encryptedCid);
  const key = getBytes(keccak256(address));
  const plain = cipherBytes.map((byte, idx) => byte ^ key[idx % key.length]);
  return new TextDecoder().decode(new Uint8Array(plain));
}

export function shortenAddress(address: string, size = 6) {
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}
