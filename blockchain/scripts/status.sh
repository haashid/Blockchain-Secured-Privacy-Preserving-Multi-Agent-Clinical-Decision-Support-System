#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Check Hyperledger Fabric Network Status
# ══════════════════════════════════════════════════════════════════════════════
# Shows container health, channel info, chaincode status, and peer details.
#
# Usage:
#   make fabric-status                   # from project root
#   bash blockchain/scripts/status.sh
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
COMPOSE_FILE="$BLOCKCHAIN_DIR/config/docker-compose-fabric.yml"
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

PEER=$(resolve_bin peer 2>/dev/null || echo "peer")

CHANNEL_NAME="${FABRIC_CHANNEL:-ai-coordination-channel}"
CHAINCODE_NAME="${FABRIC_CHAINCODE:-ai-coordination}"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

section() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

# ── Container status ────────────────────────────────────────────────────────
show_containers() {
    section "Container Status"

    if ! command -v docker &>/dev/null; then
        echo -e "${RED}docker not found on PATH${NC}"
        return
    fi

    if ! docker info &>/dev/null 2>&1; then
        echo -e "${RED}Docker daemon not running${NC}"
        return
    fi

    local containers=("orderer.ai-coordination.com" "peer0.org1.ai-coordination.com" "peer0.org2.ai-coordination.com" "couchdb0" "couchdb1" "cli")

    for c in "${containers[@]}"; do
        local status
        status=$(docker inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "not found")
        if [[ "$status" == "running" ]]; then
            echo -e "  ${GREEN}●${NC} $c — running"
        elif [[ "$status" == "not found" ]]; then
            echo -e "  ${RED}○${NC} $c — not found"
        else
            echo -e "  ${YELLOW}○${NC} $c — $status"
        fi
    done
}

# ── Channel info ────────────────────────────────────────────────────────────
show_channel_info() {
    section "Channel Info"

    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "peer0.org1"; then
        echo -e "${YELLOW}Peer not running — cannot query channel info${NC}"
        return
    fi

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt"
    export CORE_PEER_ADDRESS=localhost:7051

    local ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/msp/tlscacerts/tlsca.ai-coordination.com-cert.pem"

    echo "  Channel: $CHANNEL_NAME"
    echo ""

    # List channels
    echo "  Channels joined by peer0.org1:"
    $PEER channel list --tls --cafile "$ORDERER_CA" 2>/dev/null | sed 's/^/    /' || echo "    (unable to query)"

    echo ""

    # Get channel info
    echo "  Channel info:"
    $PEER channel getinfo -c "$CHANNEL_NAME" --tls --cafile "$ORDERER_CA" 2>/dev/null | sed 's/^/    /' || echo "    (unable to query)"
}

# ── Chaincode info ──────────────────────────────────────────────────────────
show_chaincode_info() {
    section "Chaincode Info"

    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "peer0.org1"; then
        echo -e "${YELLOW}Peer not running — cannot query chaincode${NC}"
        return
    fi

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt"
    export CORE_PEER_ADDRESS=localhost:7051

    local ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/msp/tlscacerts/tlsca.ai-coordination.com-cert.pem"

    echo "  Installed chaincodes (peer0.org1):"
    $PEER lifecycle chaincode queryinstalled --tls --cafile "$ORDERER_CA" 2>/dev/null | sed 's/^/    /' || echo "    (unable to query)"

    echo ""

    echo "  Committed chaincodes on '$CHANNEL_NAME':"
    $PEER lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME" --tls --cafile "$ORDERER_CA" 2>/dev/null | sed 's/^/    /' || echo "    (none or unable to query)"
}

# ── Port summary ────────────────────────────────────────────────────────────
show_ports() {
    section "Network Ports"

    echo "  Orderer:          localhost:7050  (orderer)"
    echo "  Orderer Admin:    localhost:7053  (admin)"
    echo "  Peer Org1:        localhost:7051  (gossip)"
    echo "  Peer Org2:        localhost:9051  (gossip)"
    echo "  CouchDB Org1:     localhost:5984  (state DB)"
    echo "  CouchDB Org2:     localhost:7984  (state DB)"
}

# ── Crypto material ─────────────────────────────────────────────────────────
show_crypto() {
    section "Crypto Material"

    local crypto_dir="$NETWORK_DIR/crypto-config"
    if [[ -d "$crypto_dir" ]]; then
        echo -e "  ${GREEN}●${NC} Crypto material present at $crypto_dir/"
    else
        echo -e "  ${RED}○${NC} Crypto material NOT found — run 'make fabric-setup' first"
    fi

    local artifacts_dir="$NETWORK_DIR/channel-artifacts"
    if [[ -d "$artifacts_dir" ]]; then
        echo -e "  ${GREEN}●${NC} Channel artifacts present at $artifacts_dir/"
    else
        echo -e "  ${RED}○${NC} Channel artifacts NOT found — run 'make fabric-setup' first"
    fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Hyperledger Fabric Network Status${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

    show_containers
    show_crypto
    show_channel_info
    show_chaincode_info
    show_ports

    echo ""
}

main "$@"
