"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet, sepolia } from "wagmi/chains";
import { getMainnetRpcUrl, getSepoliaRpcUrl } from "./constants";

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(getSepoliaRpcUrl()),
    [mainnet.id]: http(getMainnetRpcUrl()),
  },
  ssr: true,
});
