// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArtNamespaceProject} from "./ArtNamespaceProject.sol";

contract ArtNamespaceFactory {
    error ProjectAlreadyExists(bytes32 collectionHash);
    error InvalidProject();

    address[] public allProjects;
    mapping(bytes32 => address) public projectForCollectionHash;
    mapping(address => address[]) private _projectsByArtist;

    event ProjectCreated(
        address indexed project,
        address indexed artist,
        bytes32 indexed collectionHash,
        string artistENS,
        string collectionENS,
        string name,
        string symbol,
        string algorithmURI,
        bytes32 algorithmHash,
        uint256 maxSupply,
        uint256 mintPriceWei
    );

    function createProject(
        string calldata name,
        string calldata symbol,
        string calldata artistENS,
        string calldata collectionENS,
        string calldata algorithmURI,
        bytes32 algorithmHash,
        uint256 maxSupply,
        uint256 mintPriceWei
    ) external returns (address project) {
        bytes32 collectionHash = hashCollectionENS(collectionENS);
        if (projectForCollectionHash[collectionHash] != address(0)) revert ProjectAlreadyExists(collectionHash);
        if (bytes(name).length == 0 || bytes(symbol).length == 0 || bytes(collectionENS).length == 0) {
            revert InvalidProject();
        }

        project = address(
            new ArtNamespaceProject(
                name,
                symbol,
                msg.sender,
                artistENS,
                collectionENS,
                algorithmURI,
                algorithmHash,
                maxSupply,
                mintPriceWei
            )
        );

        projectForCollectionHash[collectionHash] = project;
        allProjects.push(project);
        _projectsByArtist[msg.sender].push(project);

        emit ProjectCreated(
            project,
            msg.sender,
            collectionHash,
            artistENS,
            collectionENS,
            name,
            symbol,
            algorithmURI,
            algorithmHash,
            maxSupply,
            mintPriceWei
        );
    }

    function hashCollectionENS(string memory collectionENS) public pure returns (bytes32) {
        return keccak256(bytes(collectionENS));
    }

    function allProjectsLength() external view returns (uint256) {
        return allProjects.length;
    }

    function projectsByArtist(address artist) external view returns (address[] memory) {
        return _projectsByArtist[artist];
    }
}
