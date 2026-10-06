#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Start the Hyperledger Fabric Network
# ══════════════════════════════════════════════════════════════════════════════
# Starts orderer, peers, CouchDB instances, and the CLI container.
#
# Usage:
#   make fabric-start           # from project root
#   bash blockchain/scripts/start.sh
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
COMPOSE_FILE="$BLOCKCHAIN_DIR/config/docker-compose-fabric.yml"

CHANNEL_NAME="${FABRIC_CHANNEL:-ai-coordination-channel}"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fail()  { error "$*"; exit 1; }

# ── Auto-detect Docker on Windows if not in PATH ─────────────────────
if ! command -v docker &>/dev/null; then
    DOCKER_BIN=""
    for candidate in \
        "/c/Program Files/Docker/Docker/resources/bin" \
        "/c/Users/${USER:-haash}/AppData/Local/Programs/DockerDesktop/resources/bin" \
        "/c/ProgramData/DockerDesktop/version-bin"; do
        if [[ -f "$candidate/docker.exe" ]] || [[ -f "$candidate/docker" ]]; then
            DOCKER_BIN="$candidate"
            break
        fi
    done
    if [[ -n "$DOCKER_BIN" ]]; then
        export PATH="$DOCKER_BIN:$PATH"
        info "Auto-detected Docker at: $DOCKER_BIN"
    fi
fi

# ── Check crypto material exists ───────────────────────────────────────────
check_crypto() {
    if [[ ! -d "$NETWORK_DIR/crypto-config" ]]; then
        fail "Crypto material not found at $NETWORK_DIR/crypto-config/
  Run 'make fabric-setup' first to generate crypto material."
    fi

    if [[ ! -d "$NETWORK_DIR/channel-artifacts" ]]; then
        fail "Channel artifacts not found at $NETWORK_DIR/channel-artifacts/
  Run 'make fabric-setup' first to generate channel artifacts."
    fi
}

# ── Check Docker ────────────────────────────────────────────────────────────
check_docker() {
    if ! command -v docker &>/dev/null; then
        fail "docker not found. Install Docker Desktop for Windows."
    fi

    if ! docker info &>/dev/null 2>&1; then
        fail "Docker daemon not running. Start Docker Desktop."
    fi
}

# ── Start network ──────────────────────────────────────────────────────────
start_network() {
    info "Starting Fabric network..."

    docker compose -f "$COMPOSE_FILE" up -d

    info "Waiting for containers to be healthy..."

    # Wait for orderer
    local retries=30
    while ! docker exec orderer.ai-coordination.com ls /dev/null &>/dev/null 2>&1; do
        retries=$((retries - 1))
        if [[ $retries -le 0 ]]; then
            fail "Orderer failed to start. Check: docker logs orderer.ai-coordination.com"
        fi
        sleep 1
    done
    info "Orderer is up."

    # Wait for peers
    for peer in peer0.org1.ai-coordination.com peer0.org2.ai-coordination.com; do
        retries=30
        while ! docker exec "$peer" ls /dev/null &>/dev/null 2>&1; do
            retries=$((retries - 1))
            if [[ $retries -le 0 ]]; then
                fail "$peer failed to start. Check: docker logs $peer"
            fi
            sleep 1
        done
        info "$peer is up."
    done

    info ""
    info "Fabric network started successfully!"
    info ""
    info "Orderer:  localhost:7050"
    info "Peer Org1: localhost:7051 (CouchDB: localhost:5984)"
    info "Peer Org2: localhost:9051 (CouchDB: localhost:7984)"
    info ""
    info "Channel: ${CHANNEL_NAME}"
    info ""
    info "Next: Deploy chaincode with 'make fabric-deploy'"
    info ""
}

main() {
    info "═══════════════════════════════════════════════════════════════"
    info "  Starting Hyperledger Fabric Network"
    info "═══════════════════════════════════════════════════════════════"

    check_docker
    check_crypto
    start_network
}

main "$@"
