#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Stop the Hyperledger Fabric Network
# ══════════════════════════════════════════════════════════════════════════════
# Stops all Fabric containers (orderer, peers, CouchDB, CLI).
# Optionally removes volumes to start fresh.
#
# Usage:
#   make fabric-stop                  # stop containers only
#   make fabric-stop                  # (or with CLEAN=true to remove volumes)
#   CLEAN=true make fabric-stop
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
COMPOSE_FILE="$BLOCKCHAIN_DIR/config/docker-compose-fabric.yml"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fail()  { error "$*"; exit 1; }

main() {
    info "═══════════════════════════════════════════════════════════════"
    info "  Stopping Hyperledger Fabric Network"
    info "═══════════════════════════════════════════════════════════════"

    if ! command -v docker &>/dev/null; then
        fail "docker not found. Cannot stop containers."
    fi

    local down_args=()
    if [[ "${CLEAN:-false}" == "true" ]]; then
        down_args+=("-v")  # Remove named volumes
        info "CLEAN=true: removing volumes as well."
    fi

    if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | head -1 | grep -q .; then
        docker compose -f "$COMPOSE_FILE" down "${down_args[@]}"
        info "Fabric network stopped."
    else
        warn "No running Fabric containers found."
    fi

    info ""
    info "Containers stopped."
    if [[ "${CLEAN:-false}" == "true" ]]; then
        info "Volumes removed. Run 'make fabric-setup' + 'make fabric-start' to re-initialize."
    else
        info "Crypto material and channel artifacts preserved in blockchain/network/"
        info "To start again: make fabric-start"
    fi
}

main "$@"
