// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArtNamespaceFactory} from "../src/ArtNamespaceFactory.sol";
import {ArtNamespaceProject} from "../src/ArtNamespaceProject.sol";

contract ArtNamespaceFactoryTest {
    ArtNamespaceFactory private factory;

    function setUp() public {
        factory = new ArtNamespaceFactory();
    }

    function testFactoryDeploysIndependentProjectContracts() public {
        ArtNamespaceProject first = ArtNamespaceProject(
            factory.createProject(
                "Curvefields",
                "CURVE",
                "artist.eth",
                "curvefields.artist.eth",
                "walrus://algorithm-one",
                keccak256("algorithm-one"),
                512,
                0
            )
        );
        ArtNamespaceProject second = ArtNamespaceProject(
            factory.createProject(
                "Linefields",
                "LINE",
                "artist.eth",
                "linefields.artist.eth",
                "walrus://algorithm-two",
                keccak256("algorithm-two"),
                128,
                0
            )
        );

        first.mintArtwork(address(this), "001.curvefields.artist.eth", "walrus://metadata-one", keccak256("one"));
        second.mintArtwork(address(this), "001.linefields.artist.eth", "walrus://metadata-two", keccak256("one"));

        assertEq(first.owner(), address(this), "first owner");
        assertEq(second.owner(), address(this), "second owner");
        assertEq(first.nextTokenId(), 2, "first next");
        assertEq(second.nextTokenId(), 2, "second next");
        assertEq(first.tokenENS(1), "001.curvefields.artist.eth", "first ens");
        assertEq(second.tokenENS(1), "001.linefields.artist.eth", "second ens");
        assertEq(factory.allProjectsLength(), 2, "project count");
    }

    function testDuplicateUniquenessHashFailsWithinProject() public {
        ArtNamespaceProject project = createDefaultProject();
        bytes32 uniquenessHash = keccak256("duplicate");

        project.mintArtwork(address(this), "001.curvefields.artist.eth", "walrus://one", uniquenessHash);

        try project.mintArtwork(address(this), "002.curvefields.artist.eth", "walrus://two", uniquenessHash) {
            revert("expected duplicate to fail");
        } catch (bytes memory) {
            assertTrue(true, "duplicate rejected");
        }
    }

    function testInitialFreeMint() public {
        ArtNamespaceProject project = createDefaultProject();

        uint256 tokenId = project.mintArtwork(address(this), "001.curvefields.artist.eth", "walrus://metadata", keccak256("free"));

        assertEq(project.mintPriceWei(), 0, "initial price");
        assertEq(tokenId, 1, "token id");
        assertEq(project.ownerOf(tokenId), address(this), "owner");
    }

    function testInitialPaidMintSucceeds() public {
        ArtNamespaceProject project = createDefaultProject(1 ether);

        uint256 tokenId = project.mintArtwork{value: 1 ether}(
            address(this),
            "001.curvefields.artist.eth",
            "walrus://metadata",
            keccak256("paid")
        );

        assertEq(project.mintPriceWei(), 1 ether, "price");
        assertEq(tokenId, 1, "token id");
        assertEq(address(project).balance, 1 ether, "balance");
    }

    function testUnderpaidMintFails() public {
        ArtNamespaceProject project = createDefaultProject(1 ether);

        try project.mintArtwork{value: 0.5 ether}(
            address(this),
            "001.curvefields.artist.eth",
            "walrus://metadata",
            keccak256("underpaid")
        ) {
            revert("expected underpaid mint to fail");
        } catch (bytes memory) {
            assertTrue(true, "underpaid rejected");
        }
    }

    function testWithdrawSendsMintProceeds() public {
        ArtNamespaceProject project = createDefaultProject(1 ether);
        Receiver receiver = new Receiver();
        project.mintArtwork{value: 1 ether}(
            address(this),
            "001.curvefields.artist.eth",
            "walrus://metadata",
            keccak256("withdraw")
        );

        project.withdraw(payable(address(receiver)));

        assertEq(address(project).balance, 0, "project balance");
        assertEq(address(receiver).balance, 1 ether, "receiver balance");
    }

    function testMaxSupplyIsEnforced() public {
        ArtNamespaceProject project = ArtNamespaceProject(
            factory.createProject(
                "Tiny",
                "TINY",
                "artist.eth",
                "tiny.artist.eth",
                "walrus://algorithm",
                keccak256("algorithm"),
                1,
                0
            )
        );

        project.mintArtwork(address(this), "001.tiny.artist.eth", "walrus://one", keccak256("one"));

        try project.mintArtwork(address(this), "002.tiny.artist.eth", "walrus://two", keccak256("two")) {
            revert("expected max supply to fail");
        } catch (bytes memory) {
            assertTrue(true, "max supply rejected");
        }
    }

    function createDefaultProject() internal returns (ArtNamespaceProject) {
        return createDefaultProject(0);
    }

    function createDefaultProject(uint256 mintPriceWei) internal returns (ArtNamespaceProject) {
        return ArtNamespaceProject(
            factory.createProject(
                "Curvefields",
                "CURVE",
                "artist.eth",
                "curvefields.artist.eth",
                "walrus://algorithm",
                keccak256("algorithm"),
                512,
                mintPriceWei
            )
        );
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }

    function assertEq(string memory actual, string memory expected, string memory message) internal pure {
        if (keccak256(bytes(actual)) != keccak256(bytes(expected))) revert(message);
    }

    function assertTrue(bool value, string memory message) internal pure {
        if (!value) revert(message);
    }

    receive() external payable {}
}

contract Receiver {
    receive() external payable {}
}
