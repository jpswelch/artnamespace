// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IEnsSubnameRegistrar {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);
}

contract ArtNamespaceProject {
    error AlreadyMinted(bytes32 uniquenessHash);
    error EnsSubnameCreationFailed(address registrar, string label, bytes reason);
    error InvalidRecipient();
    error InvalidEnsSubnameConfig();
    error MaxSupplyReached();
    error MintPriceNotMet(uint256 required, uint256 received);
    error NonexistentToken(uint256 tokenId);
    error NotApproved();
    error NotOwner();
    error NotTokenOwner();
    error ReentrantCall();
    error WithdrawFailed();

    string public name;
    string public symbol;
    address public owner;
    string public artistENS;
    string public collectionENS;
    string public algorithmURI;
    bytes32 public algorithmHash;
    uint256 public maxSupply;
    uint256 public mintPriceWei;
    uint256 public nextTokenId = 1;
    address public ensSubnameRegistrar;
    bytes32 public ensParentNode;
    address public ensResolver;
    uint64 public ensSubnameTtl;
    uint32 public ensSubnameFuses;
    uint64 public ensSubnameExpiry;
    bool private _minting;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    mapping(uint256 => string) public tokenENS;
    mapping(uint256 => bytes32) public tokenUniquenessHash;
    mapping(bytes32 => bool) public usedUniquenessHashes;
    mapping(uint256 => string) private _tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Withdrawal(address indexed recipient, uint256 amount);
    event EnsSubnamesConfigured(
        address indexed registrar,
        bytes32 indexed parentNode,
        address indexed resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    );
    event ArtworkSubnameCreated(uint256 indexed tokenId, string label, string artworkENS, address indexed owner);
    event ArtworkMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string artworkENS,
        string metadataURI,
        bytes32 uniquenessHash
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_minting) revert ReentrantCall();
        _minting = true;
        _;
        _minting = false;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        string memory artistENS_,
        string memory collectionENS_,
        string memory algorithmURI_,
        bytes32 algorithmHash_,
        uint256 maxSupply_,
        uint256 mintPriceWei_
    ) {
        if (owner_ == address(0)) revert InvalidRecipient();
        if (maxSupply_ == 0) revert MaxSupplyReached();

        name = name_;
        symbol = symbol_;
        owner = owner_;
        artistENS = artistENS_;
        collectionENS = collectionENS_;
        algorithmURI = algorithmURI_;
        algorithmHash = algorithmHash_;
        maxSupply = maxSupply_;
        mintPriceWei = mintPriceWei_;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidRecipient();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function withdraw(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = address(this).balance;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawal(recipient, amount);
    }

    function configureEnsSubnames(
        address registrar,
        bytes32 parentNode,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external onlyOwner {
        if (registrar != address(0) && (parentNode == bytes32(0) || resolver == address(0))) {
            revert InvalidEnsSubnameConfig();
        }

        ensSubnameRegistrar = registrar;
        ensParentNode = parentNode;
        ensResolver = resolver;
        ensSubnameTtl = ttl;
        ensSubnameFuses = fuses;
        ensSubnameExpiry = expiry;

        emit EnsSubnamesConfigured(registrar, parentNode, resolver, ttl, fuses, expiry);
    }

    function mintArtwork(
        address to,
        string calldata metadataURI,
        bytes32 uniquenessHash
    ) external payable nonReentrant returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();
        if (msg.value < mintPriceWei) revert MintPriceNotMet(mintPriceWei, msg.value);
        if (nextTokenId > maxSupply) revert MaxSupplyReached();
        if (usedUniquenessHashes[uniquenessHash]) revert AlreadyMinted(uniquenessHash);

        tokenId = nextTokenId++;
        string memory label = artworkLabel(tokenId);
        string memory artworkENS = artworkENSFor(tokenId);
        usedUniquenessHashes[uniquenessHash] = true;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        tokenENS[tokenId] = artworkENS;
        tokenUniquenessHash[tokenId] = uniquenessHash;
        _tokenURIs[tokenId] = metadataURI;

        if (ensSubnameRegistrar != address(0)) {
            _createEnsSubname(tokenId, label, artworkENS, to);
        }

        emit Transfer(address(0), to, tokenId);
        emit ArtworkMinted(tokenId, to, artworkENS, metadataURI, uniquenessHash);
    }

    function nextArtworkENS() external view returns (string memory) {
        return artworkENSFor(nextTokenId);
    }

    function artworkENSFor(uint256 tokenId) public view returns (string memory) {
        return string.concat(artworkLabel(tokenId), ".", collectionENS);
    }

    function artworkLabel(uint256 tokenId) public pure returns (string memory) {
        string memory raw = _toString(tokenId);
        if (tokenId < 10) return string.concat("00", raw);
        if (tokenId < 100) return string.concat("0", raw);
        return raw;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (ownerOf[tokenId] == address(0)) revert NonexistentToken(tokenId);
        return _tokenURIs[tokenId];
    }

    function approve(address spender, uint256 tokenId) external {
        address tokenOwner = ownerOf[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken(tokenId);
        if (msg.sender != tokenOwner && !isApprovedForAll[tokenOwner][msg.sender]) revert NotTokenOwner();

        getApproved[tokenId] = spender;
        emit Approval(tokenOwner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert InvalidRecipient();
        address tokenOwner = ownerOf[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken(tokenId);
        if (tokenOwner != from) revert NotTokenOwner();
        if (msg.sender != tokenOwner && getApproved[tokenId] != msg.sender && !isApprovedForAll[tokenOwner][msg.sender]) {
            revert NotApproved();
        }

        delete getApproved[tokenId];
        ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function _createEnsSubname(
        uint256 tokenId,
        string memory label,
        string memory artworkENS,
        address to
    ) private {
        try IEnsSubnameRegistrar(ensSubnameRegistrar).setSubnodeRecord(
            ensParentNode,
            label,
            to,
            ensResolver,
            ensSubnameTtl,
            ensSubnameFuses,
            ensSubnameExpiry
        ) returns (bytes32) {
            emit ArtworkSubnameCreated(tokenId, label, artworkENS, to);
        } catch (bytes memory reason) {
            revert EnsSubnameCreationFailed(ensSubnameRegistrar, label, reason);
        }
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
