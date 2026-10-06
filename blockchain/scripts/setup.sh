#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Fabric Network Setup
# ══════════════════════════════════════════════════════════════════════════════
# Generates crypto material (cryptogen), channel genesis block, channel tx,
# and anchor peer updates for the AI coordination network.
#
# Prerequisites:
#   - Fabric binaries on PATH: cryptogen, configtxgen
#   - Or run inside the `cli` container where these are pre-installed.
#
# Usage:
#   bash blockchain/scripts/setup.sh          # from project root
#   bash scripts/setup.sh                    # from blockchain/
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
CONFIG_DIR="$BLOCKCHAIN_DIR/config"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
BIN_DIR="$BLOCKCHAIN_DIR/bin"

# ── Add blockchain/bin to PATH (for Windows .exe binaries) ──────────────
if [[ -d "$BIN_DIR" ]]; then
    export PATH="$BIN_DIR:$PATH"
fi

# ── Detect Windows .exe environment ─────────────────────────────────────
IS_WINDOWS=false
if [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == MSYS* ]] || [[ "${OS:-}" == Windows* ]]; then
    IS_WINDOWS=true
fi

# ── Convert path to Windows format for .exe binaries ─────────────────────
winpath() {
    if $IS_WINDOWS && command -v cygpath &>/dev/null; then
        cygpath -w "$1"
    else
        echo "$1"
    fi
}

# ── Resolve binary name (handle Windows .exe suffix) ─────────────────────
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

CHANNEL_NAME="${FABRIC_CHANNEL:-ai-coordination-channel}"
CHAINCODE_NAME="${FABRIC_CHAINCODE:-ai-coordination}"
ORG1_MSP="${FABRIC_ORG1_MSP:-Org1MSP}"
ORG2_MSP="${FABRIC_ORG2_MSP:-Org2MSP}"
CONSORTIUM_NAME="AIConsortium"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fail()  { error "$*"; exit 1; }

# ── Check prerequisites ────────────────────────────────────────────────────
check_prerequisites() {
    info "Checking prerequisites..."

    CRYPTOGEN=$(resolve_bin cryptogen) || fail "cryptogen not found. Download from https://github.com/hyperledger/fabric/releases or place in $BIN_DIR/"
    CONFIGTXGEN=$(resolve_bin configtxgen) || fail "configtxgen not found. Download from https://github.com/hyperledger/fabric/releases or place in $BIN_DIR/"

    info "Using: cryptogen=$CRYPTOGEN"
    info "Using: configtxgen=$CONFIGTXGEN"

    if ! command -v docker &>/dev/null; then
        warn "docker not found on PATH — network start will need Docker Desktop."
    fi

    info "Prerequisites OK."
}

# ── Clean previous artifacts ───────────────────────────────────────────────
clean_previous() {
    info "Cleaning previous crypto material and channel artifacts..."
    rm -rf "$NETWORK_DIR/crypto-config" "$NETWORK_DIR/channel-artifacts"
    mkdir -p "$NETWORK_DIR"
    info "Cleaned."
}

# ── Generate crypto material ───────────────────────────────────────────────
generate_crypto() {
    info "Generating crypto material with cryptogen..."

    local cfg
    local out
    if $IS_WINDOWS; then
        cfg=$(winpath "$CONFIG_DIR/crypto-config.yaml")
        out=$(winpath "$NETWORK_DIR/crypto-config")
    else
        cfg="$CONFIG_DIR/crypto-config.yaml"
        out="$NETWORK_DIR/crypto-config"
    fi

    $CRYPTOGEN generate \
        --config="$cfg" \
        --output="$out"

    info "Crypto material generated at: $NETWORK_DIR/crypto-config/"
}

# ── Generate channel artifacts ─────────────────────────────────────────────
generate_channel_artifacts() {
    info "Generating channel genesis block..."

    mkdir -p "$NETWORK_DIR/channel-artifacts"

    local cpath
    if $IS_WINDOWS; then
        cpath=$(winpath "$CONFIG_DIR")
    else
        cpath="$CONFIG_DIR"
    fi

    # Genesis block for the orderer
    $CONFIGTXGEN \
        -profile AIOrdererGenesis \
        -channelID system-channel \
        -outputBlock "$NETWORK_DIR/channel-artifacts/genesis.block" \
        -configPath "$cpath"

    # Channel创 genesis block for Fabric 2.5+ osnadmin (no system channel)
    info "Generating channel创 genesis block for osnadmin..."
    $CONFIGTXGEN \
        -profile AIChannelGenesis \
        -channelID "$CHANNEL_NAME" \
        -outputBlock "$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}_genesis.block" \
        -configPath "$cpath" 2>/dev/null || warn "AIChannelGenesis block generation skipped (profile may not exist)."

    info "Generating channel transaction for '${CHANNEL_NAME}'..."

    $CONFIGTXGEN \
        -profile AIChannel \
        -channelID "$CHANNEL_NAME" \
        -outputCreateChannelTx "$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.tx" \
        -configPath "$cpath"

    info "Generating anchor peer updates..."

    $CONFIGTXGEN \
        -profile AIChannel \
        -channelID "$CHANNEL_NAME" \
        -outputAnchorPeersUpdate "$NETWORK_DIR/channel-artifacts/${ORG1_MSP}Anchors.tx" \
        -asOrg "$ORG1_MSP" \
        -configPath "$cpath" 2>/dev/null || warn "Anchor peer update for Org1 skipped (may already exist or not needed)."

    $CONFIGTXGEN \
        -profile AIChannel \
        -channelID "$CHANNEL_NAME" \
        -outputAnchorPeersUpdate "$NETWORK_DIR/channel-artifacts/${ORG2_MSP}Anchors.tx" \
        -asOrg "$ORG2_MSP" \
        -configPath "$cpath" 2>/dev/null || warn "Anchor peer update for Org2 skipped."

    info "Channel artifacts generated."
}

# ── Create channel and join peers (Fabric 2.5+ osnadmin) ────────────────
create_channel() {
    info "Creating channel '${CHANNEL_NAME}'..."

    # Verify CLI container is running (needed for osnadmin)
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^cli$'; then
        fail "CLI container is not running. Start the network first with: make fabric-start"
    fi

    local GENESIS_BLOCK="$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}_genesis.block"
    if [[ ! -f "$GENESIS_BLOCK" ]]; then
        fail "Channel创 genesis block not found at $GENESIS_BLOCK\n  Run 'make fabric-setup' first."
    fi

    # Join orderer to channel via osnadmin (runs inside CLI container)
    info "Joining orderer to channel via osnadmin..."
    docker exec cli bash -c "
        osnadmin channel join \
            -o orderer.ai-coordination.com:7053 \
            -c $CHANNEL_NAME \
            -b /opt/gopath/src/network/channel-artifacts/${CHANNEL_NAME}_genesis.block \
            --ca-file /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt \
            --client-cert /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/users/Admin@ai-coordination.com/tls/client.crt \
            --client-key /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/users/Admin@ai-coordination.com/tls/client.key
    " 2>&1 || warn "osnadmin channel join failed — channel may already exist."

    # Set environment for Org1 peer
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="$ORG1_MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051
    export ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/msp/tlscacerts/tlsca.ai-coordination.com-cert.pem"

    # Join Org1 peer
    info "Joining peer0.org1 to channel..."
    peer channel join \
        -b "$GENESIS_BLOCK" \
        --tls \
        --cafile "$ORDERER_CA"

    # Update anchor peers for Org1
    info "Updating anchor peers for Org1..."
    peer channel update \
        -o localhost:7050 \
        -c "$CHANNEL_NAME" \
        -f "$NETWORK_DIR/channel-artifacts/${ORG1_MSP}Anchors.tx" \
        --tls \
        --cafile "$ORDERER_CA" 2>/dev/null || warn "Org1 anchor update skipped."

    # Switch to Org2 peer
    export CORE_PEER_LOCALMSPID="$ORG2_MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/crypto-config/peerOrganizations/org2.ai-coordination.com/peers/peer0.org2.ai-coordination.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org2.ai-coordination.com/users/Admin@org2.ai-coordination.com/msp"
    export CORE_PEER_ADDRESS=localhost:9051

    # Join Org2 peer
    info "Joining peer0.org2 to channel..."
    peer channel join \
        -b "$GENESIS_BLOCK" \
        --tls \
        --cafile "$ORDERER_CA"

    # Update anchor peers for Org2
    info "Updating anchor peers for Org2..."
    peer channel update \
        -o localhost:7050 \
        -c "$CHANNEL_NAME" \
        -f "$NETWORK_DIR/channel-artifacts/${ORG2_MSP}Anchors.tx" \
        --tls \
        --cafile "$ORDERER_CA" 2>/dev/null || warn "Org2 anchor update skipped."

    info "All peers joined to channel '${CHANNEL_NAME}'."
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    info "═══════════════════════════════════════════════════════════════"
    info "  Hyperledger Fabric Network Setup"
    info "  Channel:  ${CHANNEL_NAME}"
    info "  Chaincode: ${CHAINCODE_NAME}"
    info "═══════════════════════════════════════════════════════════════"

    check_prerequisites
    clean_previous
    generate_crypto
    generate_channel_artifacts

    info ""
    info "Setup complete!"
    info ""
    info "Next steps:"
    info "  1. Start the network:  make fabric-start"
    info "  2. Deploy chaincode:   make fabric-deploy"
    info "  3. Check status:       make fabric-status"
    info ""
}

main "$@"
