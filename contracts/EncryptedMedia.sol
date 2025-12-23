// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted media vault using Zama FHE
/// @notice Stores encrypted IPFS identifiers alongside an encrypted decryption address
/// @dev Enforces that read methods never depend on msg.sender
contract EncryptedMedia is ZamaEthereumConfig {
    struct MediaRecord {
        string fileName;
        string encryptedCid;
        eaddress encryptedSecretAddress;
        uint64 createdAt;
    }

    mapping(address owner => MediaRecord[]) private _records;

    event MediaStored(address indexed owner, uint256 indexed index, string fileName, string encryptedCid);
    event SecretAddressAccessGranted(address indexed owner, uint256 indexed index, address indexed grantee);

    error EmptyFileName();
    error EmptyEncryptedCid();
    error InvalidRecordIndex(address owner, uint256 index);
    error UnauthorizedShare(address caller);

    /// @notice Save a media reference with an encrypted decryption address
    /// @param fileName Original file name selected by the user
    /// @param encryptedCid IPFS hash encrypted client-side with a randomly generated address
    /// @param secretAddress Client-side encrypted address used as the decryption key
    /// @param inputProof Proof returned by the relayer when encrypting the address
    function saveMedia(
        string calldata fileName,
        string calldata encryptedCid,
        externalEaddress secretAddress,
        bytes calldata inputProof
    ) external {
        if (bytes(fileName).length == 0) revert EmptyFileName();
        if (bytes(encryptedCid).length == 0) revert EmptyEncryptedCid();

        eaddress encryptedAddress = FHE.fromExternal(secretAddress, inputProof);

        MediaRecord memory record = MediaRecord({
            fileName: fileName,
            encryptedCid: encryptedCid,
            encryptedSecretAddress: encryptedAddress,
            createdAt: uint64(block.timestamp)
        });

        _records[msg.sender].push(record);
        uint256 index = _records[msg.sender].length - 1;

        // Preserve access for the contract and the owner to enable user decryption later
        FHE.allowThis(encryptedAddress);
        FHE.allow(encryptedAddress, msg.sender);

        emit MediaStored(msg.sender, index, fileName, encryptedCid);
    }

    /// @notice Share the encrypted address with another account so they can decrypt client-side
    /// @param owner Address that owns the record
    /// @param index Record index to share
    /// @param grantee Wallet to grant decryption permissions to
    function grantDecryptionAccess(address owner, uint256 index, address grantee) external {
        if (owner != msg.sender) {
            revert UnauthorizedShare(msg.sender);
        }
        MediaRecord memory record = _getRecord(owner, index);

        FHE.allow(record.encryptedSecretAddress, grantee);
        emit SecretAddressAccessGranted(owner, index, grantee);
    }

    /// @notice Return the number of records for an owner
    /// @param owner Address whose records should be counted
    function getMediaCount(address owner) external view returns (uint256) {
        return _records[owner].length;
    }

    /// @notice Read a single record for any owner
    /// @param owner Address that created the record
    /// @param index Record index to fetch
    function getMedia(address owner, uint256 index) external view returns (MediaRecord memory) {
        return _getRecord(owner, index);
    }

    /// @notice Return all stored records for an owner
    /// @param owner Address that created the records
    function listMedia(address owner) external view returns (MediaRecord[] memory) {
        return _records[owner];
    }

    function _getRecord(address owner, uint256 index) private view returns (MediaRecord memory) {
        if (index >= _records[owner].length) {
            revert InvalidRecordIndex(owner, index);
        }
        return _records[owner][index];
    }
}
