import { describe, expect, it, vi } from "vitest";
import { zeroAddress, type PublicClient, type WalletClient } from "viem";
import { ensureNameWrapped } from "./ens-name-wrapper";

const account = "0x000000000000000000000000000000000000dEaD" as const;
const resolver = "0x0000000000000000000000000000000000001234" as const;

function mockClients(options: { registryOwner?: `0x${string}` } = {}) {
  const writes: Array<{ functionName: string; args: readonly unknown[] }> = [];
  const publicClient = {
    readContract: vi.fn(async (request: { functionName: string }) => {
      if (request.functionName === "getData") return [zeroAddress, 0, 0n];
      if (request.functionName === "owner") return options.registryOwner ?? account;
      return false;
    }),
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
  } as unknown as PublicClient;
  const walletClient = {
    writeContract: vi.fn(async (request: { functionName: string; args: readonly unknown[] }) => {
      writes.push({ functionName: request.functionName, args: request.args });
      return `0x${"11".repeat(32)}` as `0x${string}`;
    }),
  } as unknown as WalletClient;

  return { publicClient, walletClient, writes };
}

describe("ENS Name Wrapper helpers", () => {
  it("wraps collection subnames directly without wrapping the .eth parent", async () => {
    const { publicClient, walletClient, writes } = mockClients();

    await ensureNameWrapped({
      publicClient,
      walletClient,
      account,
      name: "lumenloom.knicks-won.eth",
      resolver,
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].functionName).toBe("wrap");
    expect(writes[0].args[1]).toBe(account);
    expect(writes[0].args[2]).toBe(resolver);
  });

  it("explains when a collection subname is not owned in the ENS registry", async () => {
    const { publicClient, walletClient } = mockClients({ registryOwner: zeroAddress });

    await expect(
      ensureNameWrapped({
        publicClient,
        walletClient,
        account,
        name: "signalgarden.knicks-won.eth",
        resolver,
      }),
    ).rejects.toThrow("not owned in the Sepolia ENS Registry");
  });

  it("uses wrapETH2LD for bare .eth names", async () => {
    const { publicClient, walletClient, writes } = mockClients();

    await ensureNameWrapped({
      publicClient,
      walletClient,
      account,
      name: "knicks-won.eth",
      resolver,
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].functionName).toBe("wrapETH2LD");
    expect(writes[0].args).toEqual(["knicks-won", account, 0, resolver]);
  });
});
