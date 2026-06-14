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

        first.mintArtwork(address(this), "walrus://metadata-one", keccak256("one"));
        second.mintArtwork(address(this), "walrus://metadata-two", keccak256("one"));

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

        project.mintArtwork(address(this), "walrus://one", uniquenessHash);

        try project.mintArtwork(address(this), "walrus://two", uniquenessHash) {
            revert("expected duplicate to fail");
        } catch (bytes memory) {
            assertTrue(true, "duplicate rejected");
        }
    }

    function testInitialFreeMint() public {
        ArtNamespaceProject project = createDefaultProject();

        uint256 tokenId = project.mintArtwork(address(this), "walrus://metadata", keccak256("free"));

        assertEq(project.mintPriceWei(), 0, "initial price");
        assertEq(tokenId, 1, "token id");
        assertEq(project.ownerOf(tokenId), address(this), "owner");
        assertEq(project.tokenENS(tokenId), "001.curvefields.artist.eth", "artwork ens");
        assertEq(project.nextArtworkENS(), "002.curvefields.artist.eth", "next ens");
    }

    function testInitialPaidMintSucceeds() public {
        ArtNamespaceProject project = createDefaultProject(1 ether);

        uint256 tokenId = project.mintArtwork{value: 1 ether}(
            address(this),
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

        project.mintArtwork(address(this), "walrus://one", keccak256("one"));

        try project.mintArtwork(address(this), "walrus://two", keccak256("two")) {
            revert("expected max supply to fail");
        } catch (bytes memory) {
            assertTrue(true, "max supply rejected");
        }
    }

    function testEnsSubnameRegistrarIsCalledOnMint() public {
        ArtNamespaceProject project = createDefaultProject();
        MockEnsSubnameRegistrar registrar = new MockEnsSubnameRegistrar();
        bytes32 parentNode = keccak256("curvefields.artist.eth");
        address resolver = address(0x1234);
        address collector = address(0xBEEF);

        project.configureEnsSubnames(address(registrar), parentNode, resolver, 0, 0, 9999999999);
        uint256 tokenId = project.mintArtwork(collector, "walrus://metadata", keccak256("ens"));

        assertEq(tokenId, 1, "token id");
        assertEq(registrar.lastParentNode(), parentNode, "parent node");
        assertEq(registrar.lastLabel(), "001", "label");
        assertEq(registrar.lastOwner(), collector, "subname owner");
        assertEq(registrar.lastResolver(), resolver, "resolver");
        assertEq(project.tokenENS(tokenId), "001.curvefields.artist.eth", "token ens");
    }

    function testCollectorMintRevertsWhenProjectLacksEnsApproval() public {
        ArtNamespaceProject project = createDefaultProject();
        bytes32 parentNode = keccak256("curvefields.artist.eth");
        MockNameWrapperRegistrar registrar = new MockNameWrapperRegistrar(parentNode, address(this));
        CollectorCaller collector = new CollectorCaller();

        project.configureEnsSubnames(address(registrar), parentNode, address(0x1234), 0, 0, 0);

        try collector.mint(project, address(collector), "walrus://metadata", keccak256("collector-no-approval")) {
            revert("expected mint to fail without name wrapper approval");
        } catch (bytes memory) {
            assertTrue(true, "name wrapper approval required");
        }

        assertEq(project.nextTokenId(), 1, "mint reverted token sequence");
        assertEq(project.balanceOf(address(collector)), 0, "collector has no token");
    }

    function testCollectorMintsCreateSequentialEnsSubnamesWhenProjectIsApproved() public {
        ArtNamespaceProject project = createDefaultProject();
        bytes32 parentNode = keccak256("curvefields.artist.eth");
        address resolver = address(0x1234);
        MockNameWrapperRegistrar registrar = new MockNameWrapperRegistrar(parentNode, address(this));
        CollectorCaller firstCollector = new CollectorCaller();
        CollectorCaller secondCollector = new CollectorCaller();

        project.configureEnsSubnames(address(registrar), parentNode, resolver, 0, 0, 0);
        registrar.setApprovalForAll(address(project), true);

        uint256 firstTokenId = firstCollector.mint(
            project,
            address(firstCollector),
            "walrus://metadata-one",
            keccak256("collector-one")
        );

        assertEq(firstTokenId, 1, "first token id");
        assertEq(registrar.lastCaller(), address(project), "project creates first subname");
        assertEq(registrar.lastParentNode(), parentNode, "first parent node");
        assertEq(registrar.lastLabel(), "001", "first label");
        assertEq(registrar.lastOwner(), address(firstCollector), "first subname owner");
        assertEq(registrar.lastResolver(), resolver, "first resolver");
        assertEq(project.ownerOf(firstTokenId), address(firstCollector), "first token owner");
        assertEq(project.tokenENS(firstTokenId), "001.curvefields.artist.eth", "first token ens");

        uint256 secondTokenId = secondCollector.mint(
            project,
            address(secondCollector),
            "walrus://metadata-two",
            keccak256("collector-two")
        );

        assertEq(secondTokenId, 2, "second token id");
        assertEq(registrar.lastCaller(), address(project), "project creates second subname");
        assertEq(registrar.lastLabel(), "002", "second label");
        assertEq(registrar.lastOwner(), address(secondCollector), "second subname owner");
        assertEq(project.ownerOf(secondTokenId), address(secondCollector), "second token owner");
        assertEq(project.tokenENS(secondTokenId), "002.curvefields.artist.eth", "second token ens");
        assertEq(project.nextArtworkENS(), "003.curvefields.artist.eth", "next ens");
    }

    function testNonOwnerCannotConfigureEnsSubnames() public {
        ArtNamespaceProject project = createDefaultProject();
        ProjectCaller caller = new ProjectCaller();

        try caller.configureEnsSubnames(project, address(0x1234), keccak256("node"), address(0x5678)) {
            revert("expected non-owner configure to fail");
        } catch (bytes memory) {
            assertTrue(true, "non-owner rejected");
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

    function assertEq(bytes32 actual, bytes32 expected, string memory message) internal pure {
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

contract CollectorCaller {
    function mint(
        ArtNamespaceProject project,
        address to,
        string calldata metadataURI,
        bytes32 uniquenessHash
    ) external payable returns (uint256) {
        return project.mintArtwork{value: msg.value}(to, metadataURI, uniquenessHash);
    }
}

contract MockEnsSubnameRegistrar {
    bytes32 public lastParentNode;
    string public lastLabel;
    address public lastOwner;
    address public lastResolver;
    uint64 public lastTtl;
    uint32 public lastFuses;
    uint64 public lastExpiry;

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32) {
        lastParentNode = parentNode;
        lastLabel = label;
        lastOwner = owner;
        lastResolver = resolver;
        lastTtl = ttl;
        lastFuses = fuses;
        lastExpiry = expiry;

        return keccak256(abi.encode(parentNode, label));
    }
}

contract MockNameWrapperRegistrar {
    error Unauthorised(bytes32 node, address caller);
    error UnexpectedParentNode(bytes32 expected, bytes32 actual);

    bytes32 public immutable expectedParentNode;
    address public immutable wrappedOwner;
    bytes32 public lastParentNode;
    string public lastLabel;
    address public lastOwner;
    address public lastResolver;
    address public lastCaller;
    uint64 public lastTtl;
    uint32 public lastFuses;
    uint64 public lastExpiry;

    mapping(address => mapping(address => bool)) public isApprovedForAll;

    constructor(bytes32 expectedParentNode_, address wrappedOwner_) {
        expectedParentNode = expectedParentNode_;
        wrappedOwner = wrappedOwner_;
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32) {
        if (parentNode != expectedParentNode) revert UnexpectedParentNode(expectedParentNode, parentNode);
        if (msg.sender != wrappedOwner && !isApprovedForAll[wrappedOwner][msg.sender]) {
            revert Unauthorised(parentNode, msg.sender);
        }

        lastParentNode = parentNode;
        lastLabel = label;
        lastOwner = owner;
        lastResolver = resolver;
        lastCaller = msg.sender;
        lastTtl = ttl;
        lastFuses = fuses;
        lastExpiry = expiry;

        return keccak256(abi.encode(parentNode, label));
    }
}

contract ProjectCaller {
    function configureEnsSubnames(
        ArtNamespaceProject project,
        address registrar,
        bytes32 parentNode,
        address resolver
    ) external {
        project.configureEnsSubnames(registrar, parentNode, resolver, 0, 0, 0);
    }
}
