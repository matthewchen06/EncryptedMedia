import { useMemo, useState } from 'react';
import { Wallet, ethers } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import {
  decryptCidWithAddress,
  encryptCidWithAddress,
  generatePseudoIpfsHash,
  shortenAddress,
} from '../utils/encryption';
import '../styles/Media.css';

type MediaRecord = {
  fileName: string;
  encryptedCid: string;
  encryptedSecretAddress: string;
  createdAt: bigint;
};

type DecryptedState = Record<number, { cid: string; secret: string }>;

function formatTimestamp(value?: bigint) {
  if (!value) return '—';
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return '—';
  return new Date(asNumber * 1000).toLocaleString();
}

export function EncryptedMediaApp() {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: isZamaLoading, error: zamaError } = useZamaInstance();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [decryptingIndex, setDecryptingIndex] = useState<number | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedState>({});
  const [lastSecrets, setLastSecrets] = useState<{ cid: string; secret: string } | null>(null);

  const {
    data: rawRecords,
    refetch: refetchRecords,
    isFetching: isLoadingRecords,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'listMedia',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const records = useMemo<MediaRecord[]>(() => {
    if (!rawRecords) return [];
    return (rawRecords as any[]).map((entry: any) => ({
      fileName: entry.fileName ?? entry[0],
      encryptedCid: entry.encryptedCid ?? entry[1],
      encryptedSecretAddress: entry.encryptedSecretAddress ?? entry[2],
      createdAt: BigInt(entry.createdAt ?? entry[3]),
    }));
  }, [rawRecords]);

  const ready = Boolean(instance) && !isZamaLoading;

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus('Choose an image or video to continue.');
      return;
    }

    if (!address) {
      setStatus('Connect your wallet to store media.');
      return;
    }

    if (!ready || !instance) {
      setStatus('Encryption service is still loading.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatus('No signer available from your wallet.');
      return;
    }

    setUploading(true);
    setStatus('Preparing encrypted payload...');

    try {
      const ipfsHash = generatePseudoIpfsHash(selectedFile.name);
      const secretWallet = Wallet.createRandom();
      const encryptedCid = encryptCidWithAddress(ipfsHash, secretWallet.address);

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(secretWallet.address);
      const encryptedInput = await buffer.encrypt();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      setStatus('Submitting transaction to save your media...');
      const tx = await contract.saveMedia(
        selectedFile.name,
        encryptedCid,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );

      await tx.wait();
      setStatus('Saved on-chain. You can decrypt it from the list below.');
      setLastSecrets({ cid: ipfsHash, secret: secretWallet.address });
      setSelectedFile(null);
      setDecrypted({});
      await refetchRecords();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Upload failed: ${message}`);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const decryptRecord = async (record: MediaRecord, index: number) => {
    if (!address) {
      setStatus('Connect your wallet to decrypt.');
      return;
    }
    if (!instance || !ready) {
      setStatus('Encryption service is still loading.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatus('No signer available from your wallet.');
      return;
    }

    setDecryptingIndex(index);
    setStatus(null);

    try {
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        [
          {
            handle: record.encryptedSecretAddress,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedAddress = result[record.encryptedSecretAddress] as string;
      const cid = decryptCidWithAddress(record.encryptedCid, decryptedAddress);

      setDecrypted((previous) => ({
        ...previous,
        [index]: {
          cid,
          secret: decryptedAddress,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Decryption failed: ${message}`);
      console.error(error);
    } finally {
      setDecryptingIndex(null);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Encrypted media vault</p>
          <h1>Lock IPFS references with FHE</h1>
          <p className="lede">
            Generate a fresh EVM address per upload, encrypt your IPFS hash with it, and store everything on-chain with
            Zama FHE.
          </p>
          <div className="hero-actions">
            <div className="pill">Step 1 · Upload</div>
            <div className="pill">Step 2 · Store</div>
            <div className="pill">Step 3 · Decrypt</div>
          </div>
        </div>
      </header>

      <section className="layout">
        <div className="card upload-card">
          <div className="card-head">
            <div>
              <h2>Upload & encrypt</h2>
              <p className="muted">
                Pick an image or video. We create a pseudo IPFS hash, encrypt it with a random address, and push the
                encrypted payload on-chain.
              </p>
            </div>
            <div className={`status-dot ${ready ? 'ready' : 'pending'}`}>
              {ready ? 'Relayer ready' : 'Loading relayer'}
            </div>
          </div>

          <div className="uploader">
            <label className="file-picker">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <div>
                <p className="file-title">{selectedFile ? selectedFile.name : 'Choose a file'}</p>
                <p className="muted">We never upload the file itself, only the encrypted reference.</p>
              </div>
            </label>

            <div className="actions">
              <button className="primary" onClick={handleUpload} disabled={uploading || !isConnected || !ready}>
                {uploading ? 'Saving...' : 'Encrypt & Save'}
              </button>
              <div className="helper">
                {status ? <span>{status}</span> : zamaError ? <span>{zamaError}</span> : null}
              </div>
            </div>
          </div>

          {lastSecrets ? (
            <div className="inline-card">
              <div>
                <p className="muted">Latest upload</p>
                <p className="secret">{lastSecrets.cid}</p>
              </div>
              <div>
                <p className="muted">Secret address</p>
                <p className="secret">{shortenAddress(lastSecrets.secret)}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card list-card">
          <div className="card-head">
            <h2>My encrypted media</h2>
            <p className="muted">Stored on-chain with encrypted IPFS hashes and FHE-protected addresses.</p>
          </div>

          {!isConnected ? (
            <div className="empty-state">
              <p>Connect your wallet to see your encrypted uploads.</p>
            </div>
          ) : isLoadingRecords ? (
            <div className="empty-state">
              <p>Loading your records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <p>No media saved yet. Upload your first file to get started.</p>
            </div>
          ) : (
            <div className="grid">
              {records.map((record, index) => {
                const decryptedEntry = decrypted[index];
                return (
                  <div key={`${record.encryptedCid}-${index}`} className="record">
                    <div className="record-head">
                      <div>
                        <p className="record-name">{record.fileName}</p>
                        <p className="muted">Stored {formatTimestamp(record.createdAt)}</p>
                      </div>
                      <span className="pill pill-dark">#{index + 1}</span>
                    </div>

                    <div className="record-body">
                      <div>
                        <p className="label">Encrypted IPFS</p>
                        <code className="mono">{record.encryptedCid.slice(0, 42)}...</code>
                      </div>
                      <div>
                        <p className="label">Encrypted address</p>
                        <code className="mono">{record.encryptedSecretAddress}</code>
                      </div>
                    </div>

                    {decryptedEntry ? (
                      <div className="decrypted">
                        <div>
                          <p className="label">Decrypted address</p>
                          <p className="secret">{decryptedEntry.secret}</p>
                        </div>
                        <div>
                          <p className="label">IPFS hash</p>
                          <p className="secret">{decryptedEntry.cid}</p>
                        </div>
                        <a
                          className="link"
                          href={`https://ipfs.io/ipfs/${decryptedEntry.cid}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open via ipfs.io ↗
                        </a>
                      </div>
                    ) : (
                      <button
                        className="ghost"
                        onClick={() => decryptRecord(record, index)}
                        disabled={decryptingIndex === index}
                      >
                        {decryptingIndex === index ? 'Decrypting...' : 'Decrypt address & IPFS hash'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
