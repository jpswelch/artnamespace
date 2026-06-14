SHELL := /bin/bash

CONTRACTS_DIR := contracts
FACTORY_CONTRACT := src/ArtNamespaceFactory.sol:ArtNamespaceFactory

-include .env
-include apps/web/.env.local

SEPOLIA_RPC_URL ?= $(NEXT_PUBLIC_SEPOLIA_RPC_URL)
DEPLOYER_ACCOUNT ?= testkey

.PHONY: help contracts-build contracts-test deploy-factory deploy-factory-verify print-factory-env check-sepolia-env check-etherscan-env

help:
	@echo "ArtNamespace deployment helpers"
	@echo ""
	@echo "Targets:"
	@echo "  make contracts-build          Build Foundry contracts"
	@echo "  make contracts-test           Run Foundry tests"
	@echo "  make deploy-factory           Deploy ArtNamespaceFactory to Sepolia"
	@echo "  make deploy-factory-verify    Deploy and verify ArtNamespaceFactory on Etherscan"
	@echo "  make print-factory-env FACTORY=0x..."
	@echo ""
	@echo "Required env for deploy:"
	@echo "  SEPOLIA_RPC_URL or NEXT_PUBLIC_SEPOLIA_RPC_URL"
	@echo ""
	@echo "Foundry deploy account:"
	@echo "  DEPLOYER_ACCOUNT=$(DEPLOYER_ACCOUNT)"
	@echo ""
	@echo "Optional env for verify:"
	@echo "  ETHERSCAN_API_KEY"

contracts-build:
	cd $(CONTRACTS_DIR) && forge build

contracts-test:
	cd $(CONTRACTS_DIR) && forge test

deploy-factory: check-sepolia-env
	cd $(CONTRACTS_DIR) && forge create $(FACTORY_CONTRACT) \
		--rpc-url "$(SEPOLIA_RPC_URL)" \
		--account "$(DEPLOYER_ACCOUNT)" \
		--broadcast
	@echo ""
	@echo "Copy the deployed address into apps/web/.env.local:"
	@echo "NEXT_PUBLIC_ARTNAMESPACE_FACTORY=0x..."

deploy-factory-verify: check-sepolia-env check-etherscan-env
	cd $(CONTRACTS_DIR) && forge create $(FACTORY_CONTRACT) \
		--rpc-url "$(SEPOLIA_RPC_URL)" \
		--account "$(DEPLOYER_ACCOUNT)" \
		--broadcast \
		--verify \
		--etherscan-api-key "$(ETHERSCAN_API_KEY)"
	@echo ""
	@echo "Copy the deployed address into apps/web/.env.local:"
	@echo "NEXT_PUBLIC_ARTNAMESPACE_FACTORY=0x..."

print-factory-env:
	@if [ -z "$(FACTORY)" ]; then \
		echo "Usage: make print-factory-env FACTORY=0x..."; \
		exit 1; \
	fi
	@echo "NEXT_PUBLIC_ARTNAMESPACE_FACTORY=$(FACTORY)"

check-sepolia-env:
	@if [ -z "$(SEPOLIA_RPC_URL)" ]; then \
		echo "Missing SEPOLIA_RPC_URL or NEXT_PUBLIC_SEPOLIA_RPC_URL"; \
		exit 1; \
	fi

check-etherscan-env:
	@if [ -z "$(ETHERSCAN_API_KEY)" ]; then \
		echo "Missing ETHERSCAN_API_KEY"; \
		exit 1; \
	fi
