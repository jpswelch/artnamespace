// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ArtNamespaceDrop {
    error AlreadyMinted(bytes32 uniquenessHash);
    error NotTokenOwner();
    error NonexistentToken(uint256 tokenId);
    error InvalidRecipient();
    error NotApproved();

    string public name;
    string public symbol;
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
    event ArtworkMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string artworkENS,
        string metadataURI,
        bytes32 uniquenessHash
    );

    constructor() {
        name = "ArtNamespace Drop";
        symbol = "ARTNS";
    }

    function mintArtwork(
        address to,
        string calldata artworkENS,
        string calldata metadataURI,
        bytes32 uniquenessHash
    ) external payable returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();
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
        address owner = ownerOf[tokenId];
        if (owner == address(0)) revert NonexistentToken(tokenId);
        if (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) revert NotTokenOwner();

        getApproved[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert InvalidRecipient();
        address owner = ownerOf[tokenId];
        if (owner == address(0)) revert NonexistentToken(tokenId);
        if (owner != from) revert NotTokenOwner();
        if (msg.sender != owner && getApproved[tokenId] != msg.sender && !isApprovedForAll[owner][msg.sender]) {
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
