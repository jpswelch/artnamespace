// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArtNamespaceDrop} from "../src/ArtNamespaceDrop.sol";

contract ArtNamespaceDropTest {
    ArtNamespaceDrop private drop;

    function setUp() public {
        drop = new ArtNamespaceDrop();
    }

    function testMintStoresArtwork() public {
        bytes32 uniquenessHash = keccak256("curvefields-001");

        uint256 tokenId = drop.mintArtwork(
            address(this),
            "001.curvefields.artnamespace-demo.eth",
            "walrus://metadata",
            uniquenessHash
        );

        assertEq(tokenId, 1, "token id");
        assertEq(drop.ownerOf(tokenId), address(this), "owner");
        assertEq(drop.balanceOf(address(this)), 1, "balance");
        assertEq(drop.tokenENS(tokenId), "001.curvefields.artnamespace-demo.eth", "ens");
        assertEq(drop.tokenURI(tokenId), "walrus://metadata", "uri");
        assertEq(drop.tokenUniquenessHash(tokenId), uniquenessHash, "hash");
        assertTrue(drop.usedUniquenessHashes(uniquenessHash), "used hash");
    }

    function testDuplicateUniquenessHashFails() public {
        bytes32 uniquenessHash = keccak256("duplicate");

        drop.mintArtwork(address(this), "001.curvefields.artnamespace-demo.eth", "walrus://one", uniquenessHash);

        try drop.mintArtwork(address(this), "002.curvefields.artnamespace-demo.eth", "walrus://two", uniquenessHash) {
            revert("expected duplicate to fail");
        } catch (bytes memory) {
            assertTrue(true, "duplicate rejected");
        }
    }

    function testNextTokenIdIncrements() public {
        drop.mintArtwork(address(this), "001.curvefields.artnamespace-demo.eth", "walrus://one", keccak256("one"));
        drop.mintArtwork(address(this), "002.curvefields.artnamespace-demo.eth", "walrus://two", keccak256("two"));

        assertEq(drop.nextTokenId(), 3, "next");
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }

    function assertEq(bytes32 actual, bytes32 expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }

    function assertEq(string memory actual, string memory expected, string memory message) internal pure {
        if (keccak256(bytes(actual)) != keccak256(bytes(expected))) revert(message);
    }

    function assertTrue(bool value, string memory message) internal pure {
        if (!value) revert(message);
    }
}
