// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArtNamespaceDrop} from "../src/ArtNamespaceDrop.sol";

contract Deploy {
    function deploy() external returns (ArtNamespaceDrop) {
        return new ArtNamespaceDrop();
    }
}
