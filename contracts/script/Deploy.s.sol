// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArtNamespaceFactory} from "../src/ArtNamespaceFactory.sol";

contract Deploy {
    function deploy() external returns (ArtNamespaceFactory) {
        return new ArtNamespaceFactory();
    }
}
