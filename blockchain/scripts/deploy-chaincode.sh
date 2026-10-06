#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Deploy Chaincode to Hyperledger Fabric Network
# ══════════════════════════════════════════════════════════════════════════════
# Performs the full Fabric v2.x chaincode lifecycle:
#   1. Package chaincode (Go)
#   2. Install on both Org1 and Org2 peers
#   3. Approve for Org1
#   4. Approve for Org2
#   5. Commit chaincode definition
#
# Prerequisites:
#   - Network must be running (make fabric-start)
#   - Setup must have been run (make fabric-setup)
#
# Usage:
#   make fabric-deploy                    # from project root
#   bash blockchain/scripts/deploy-chaincode.sh
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
CHAINCODE_DIR="$BLOCKCHAIN_DIR/chaincode"
BIN_DIR="$BLOCKCHAIN_DIR/bin"

# ── Add blockchain/bin to PATH and resolve binary names ──────────────
if [[ -d "$BIN_DIR" ]]; then
    export PATH="$BIN_DIR:$PATH"
fi

resolve_bin() {
    local name="$1"
    if command -v "$name" &>/dev/null; then
        echo "$name"
    elif command -v "${name}.exe" &>/dev/null; then
        echo "${name}.exe"
    elif [[ -x "$BIN_DIR/$name" ]]; then
        echo "$BIN_DIR/$name"
    elif [[ -x "$BIN_DIR/${name}.exe" ]]; then
        echo "$BIN_DIR/${name}.exe"
    else
        return 1
    fi
}

PEER=$(resolve_bin peer) || { echo "ERROR: peer binary not found"; exit 1; }

CHANNEL_NAME="${FABRIC_CHANNEL:-ai-coordination-channel}"
CHAINCODE_NAME="${FABRIC_CHAINCODE:-ai-coordination}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fail()  { error "$*"; exit 1; }

# ── Environment helpers ─────────────────────────────────────────────────────
ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/msp/tlscacerts/tlsca.ai-coordination.com-cert.pem"
TLS_CA_ORG1="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt"
TLS_CA_ORG2="$NETWORK_DIR/crypto-config/peerOrganizations/org2.ai-coordination.com/peers/peer0.org2.ai-coordination.com/tls/ca.crt"

set_env_org1() {
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp"
    export CORE_PEER_TLS_ROOTCERT_FILE="$TLS_CA_ORG1"
    export CORE_PEER_ADDRESS=localhost:7051
    export CORE_PEER_TLS_ENABLED=true
}

set_env_org2() {
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org2.ai-coordination.com/users/Admin@org2.ai-coordination.com/msp"
    export CORE_PEER_TLS_ROOTCERT_FILE="$TLS_CA_ORG2"
    export CORE_PEER_ADDRESS=localhost:9051
    export CORE_PEER_TLS_ENABLED=true
}

# ── Step 1: Package chaincode ──────────────────────────────────────────────
package_chaincode() {
    info "Step 1: Packaging chaincode..."

    # Create a temporary directory with a go.mod for the chaincode
    local staging
    staging=$(mktemp -d 2>/dev/null || mktemp -d -t fabric-cc 2>/dev/null || echo "$BLOCKCHAIN_DIR/_staging")
    mkdir -p "$staging"
    cp "$CHAINCODE_DIR"/*.go "$staging/"

    # Create a minimal go.mod if one doesn't exist in chaincode dir
    if [[ ! -f "$CHAINCODE_DIR/go.mod" ]]; then
        cat > "$staging/go.mod" <<'GOMOD'
module github.com/ai-coordination/chaincode

go 1.21

require (
    github.com/hyperledger/fabric-contract-api-go v1.2.2
    github.com/hyperledger/fabric-chaincode-go v0.0.0-20230731094903-25bc155b0b5f
    github.com/hyperledger/fabric-protos-go v0.3.3
)
GOMOD
    fi

    set_env_org1
    $PEER lifecycle chaincode package "${NETWORK_DIR}/${CHAINCODE_LABEL}.tar.gz" \
        --path "$staging" \
        --lang golang \
        --label "$CHAINCODE_LABEL" \
        --tls \
        --cafile "$ORDERER_CA"

    rm -rf "$staging"
    info "Chaincode packaged: ${CHAINCODE_LABEL}.tar.gz"
}

# ── Step 2: Install on peers ──────────────────────────────────────────────
install_chaincode() {
    info "Step 2: Installing chaincode on peers..."

    # Install on Org1
    set_env_org1
    $PEER lifecycle chaincode install "${NETWORK_DIR}/${CHAINCODE_LABEL}.tar.gz" \
        --tls \
        --cafile "$ORDERER_CA" 2>&1 | grep -v "^$" || true

    # Get package ID
    local pkg_id
    pkg_id=$($PEER lifecycle chaincode queryinstalled --tls --cafile "$ORDERER_CA" 2>/dev/null \
        | grep "${CHAINCODE_LABEL}" | sed -n 's/.*Package ID: \([^,]*\).*/\1/p' | head -1)

    if [[ -z "$pkg_id" ]]; then
        fail "Could not retrieve package ID after install on Org1."
    fi
    info "Package ID: $pkg_id"

    # Install on Org2
    set_env_org2
    $PEER lifecycle chaincode install "${NETWORK_DIR}/${CHAINCODE_LABEL}.tar.gz" \
        --tls \
        --cafile "$ORDERER_CA" 2>&1 | grep -v "^$" || true

    info "Chaincode installed on both peers."

    # Return package ID for later use
    echo "$pkg_id" > "$NETWORK_DIR/.chaincode-package-id"
}

# ── Step 3: Approve for Org1 ──────────────────────────────────────────────
approve_org1() {
    info "Step 3: Approving chaincode for Org1..."
    local pkg_id
    pkg_id=$(cat "$NETWORK_DIR/.chaincode-package-id")

    set_env_org1
    $PEER lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" \
        --version "$CHAINCODE_VERSION" \
        --package-id "$pkg_id" \
        --sequence "$CHAINCODE_SEQUENCE" \
        --init-required \
        --tls \
        --cafile "$ORDERER_CA"

    info "Org1 approved."
}

# ── Step 4: Approve for Org2 ──────────────────────────────────────────────
approve_org2() {
    info "Step 4: Approving chaincode for Org2..."
    local pkg_id
    pkg_id=$(cat "$NETWORK_DIR/.chaincode-package-id")

    set_env_org2
    $PEER lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" \
        --version "$CHAINCODE_VERSION" \
        --package-id "$pkg_id" \
        --sequence "$CHAINCODE_SEQUENCE" \
        --init-required \
        --tls \
        --cafile "$ORDERER_CA"

    info "Org2 approved."
}

# ── Step 5: Commit chaincode definition ────────────────────────────────────
commit_chaincode() {
    info "Step 5: Committing chaincode definition..."

    set_env_org1
    $PEER lifecycle chaincode commit \
        -o localhost:7050 \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" \
        --version "$CHAINCODE_VERSION" \
        --sequence "$CHAINCODE_SEQUENCE" \
        --init-required \
        --tls \
        --cafile "$ORDERER_CA" \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "$TLS_CA_ORG1" \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles "$TLS_CA_ORG2"

    info "Chaincode committed successfully!"
}

# ── Step 6: Initialize ledger ──────────────────────────────────────────────
init_ledger() {
    info "Step 6: Initializing ledger..."

    set_env_org1
    $PEER chaincode invoke \
        -o localhost:7050 \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" \
        --isInit \
        -c '{"function":"InitLedger","args":[]}' \
        --tls \
        --cafile "$ORDERER_CA" \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "$TLS_CA_ORG1" \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles "$TLS_CA_ORG2"

    info "Ledger initialized."
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    info "═══════════════════════════════════════════════════════════════"
    info "  Deploying Chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}"
    info "  Channel: ${CHANNEL_NAME}"
    info "═══════════════════════════════════════════════════════════════"

    # Verify network is running
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "orderer.ai-coordination.com"; then
        fail "Fabric network is not running. Start with: make fabric-start"
    fi

    package_chaincode
    install_chaincode
    approve_org1
    approve_org2
    commit_chaincode
    init_ledger

    info ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Chaincode deployed and initialized!"
    info "  ${CHAINCODE_NAME} v${CHAINCODE_VERSION} on ${CHANNEL_NAME}"
    info "═══════════════════════════════════════════════════════════════"
    info ""
}

main "$@"
