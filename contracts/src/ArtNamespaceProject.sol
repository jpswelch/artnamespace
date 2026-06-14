// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ArtNamespaceProject {
    error AlreadyMinted(bytes32 uniquenessHash);
    error InvalidRecipient();
    error MaxSupplyReached();
    error MintPriceNotMet(uint256 required, uint256 received);
    error NonexistentToken(uint256 tokenId);
    error NotApproved();
    error NotOwner();
    error NotTokenOwner();
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

    function mintArtwork(
        address to,
        string calldata artworkENS,
        string calldata metadataURI,
        bytes32 uniquenessHash
    ) external payable returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();
        if (msg.value < mintPriceWei) revert MintPriceNotMet(mintPriceWei, msg.value);
        if (nextTokenId > maxSupply) revert MaxSupplyReached();
        if (usedUniquenessHashes[uniquenessHash]) revert AlreadyMinted(uniquenessHash);

        tokenId = nextTokenId++;
        usedUniquenessHashes[uniquenessHash] = true;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        tokenENS[tokenId] = artworkENS;
        tokenUniquenessHash[tokenId] = uniquenessHash;
        _tokenURIs[tokenId] = metadataURI;

        emit Transfer(address(0), to, tokenId);
        emit ArtworkMinted(tokenId, to, artworkENS, metadataURI, uniquenessHash);
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
}
