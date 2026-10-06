#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Complete Fabric Network Setup
# Starts containers, creates channel, joins peers, deploys chaincode
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
CONFIG_DIR="$BLOCKCHAIN_DIR/config"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
COMPOSE_FILE="$CONFIG_DIR/docker-compose-fabric.yml"

CHANNEL_NAME="${FABRIC_CHANNEL:-ai-coordination-channel}"
CHAINCODE_NAME="${FABRIC_CHAINCODE:-ai-coordination}"
CHAINCODE_LABEL="${CHAINCODE_NAME}_1.0"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

# ── Auto-detect Docker ───────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    for candidate in \
        "/c/Program Files/Docker/Docker/resources/bin" \
        "/c/Users/${USER:-haash}/AppData/Local/Programs/DockerDesktop/resources/bin"; do
        if [[ -f "$candidate/docker.exe" ]] || [[ -f "$candidate/docker" ]]; then
            export PATH="$candidate:$PATH"
            info "Auto-detected Docker at: $candidate"
            break
        fi
    done
fi

command -v docker &>/dev/null || fail "docker not found"
docker info &>/dev/null 2>&1 || fail "Docker daemon not running"

# ── Step 1: Start containers ────────────────────────────────────────
info "═══ Step 1/5: Starting Fabric containers ═══"
docker compose -f "$COMPOSE_FILE" up -d 2>&1

info "Waiting for containers..."
for name in orderer.ai-coordination.com peer0.org1.ai-coordination.com peer0.org2.ai-coordination.com; do
    retries=30
    while ! docker exec "$name" ls /dev/null &>/dev/null 2>&1; do
        retries=$((retries - 1))
        [[ $retries -le 0 ]] && fail "$name failed to start"
        sleep 2
    done
    info "  $name ✓"
done
info "All containers started."

# ── Step 2: Generate channel genesis block ──────────────────────────
info "═══ Step 2/5: Generating channel genesis block ═══"
cd "$BLOCKCHAIN_DIR"
mkdir -p network/channel-artifacts

# Use Windows .exe binaries if available
CFGTXGEN="configtxgen"
if [[ -x blockchain/bin/configtxgen.exe ]] || [[ -x bin/configtxgen.exe ]]; then
    CFGTXGEN="$(pwd)/bin/configtxgen.exe"
elif command -v configtxgen.exe &>/dev/null; then
    CFGTXGEN="configtxgen.exe"
elif command -v configtxgen &>/dev/null; then
    CFGTXGEN="configtxgen"
else
    fail "configtxgen not found"
fi

"$CFGTXGEN" \
    -profile AIChannelGenesis \
    -channelID "$CHANNEL_NAME" \
    -outputBlock "network/channel-artifacts/${CHANNEL_NAME}_genesis.block" \
    -configPath "$(pwd)/config" \
    2>&1 || fail "Failed to generate channel genesis block"

info "Channel genesis block created: network/channel-artifacts/${CHANNEL_NAME}_genesis.block ✓"

# ── Step 3: Create channel via osnadmin ─────────────────────────────
info "═══ Step 3/5: Creating channel via osnadmin ═══"

# osnadmin needs to run INSIDE the CLI container (avoids host TLS issues)
docker exec cli bash -c "
    osnadmin channel join \
        -o orderer.ai-coordination.com:7053 \
        -c $CHANNEL_NAME \
        -b /opt/gopath/src/network/channel-artifacts/${CHANNEL_NAME}_genesis.block \
        --ca-file /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt \
        --client-cert /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/users/Admin@ai-coordination.com/tls/client.crt \
        --client-key /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/users/Admin@ai-coordination.com/tls/client.key
" 2>&1 || warn "osnadmin may have failed (channel might already exist)"

info "Channel creation attempted. Checking..."
docker exec cli bash -c "osnadmin channel list -o orderer.ai-coordination.com:7053 \
    --ca-file /opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt" 2>&1 || true

# ── Step 4: Join peers to channel ──────────────────────────────────
info "═══ Step 4/5: Joining peers to channel ═══"

docker exec cli bash -c "
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/network/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/network/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt
    export CORE_PEER_ADDRESS=peer0.org1.ai-coordination.com:7051
    export ORDERER_CA=/opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt

    echo '--- Fetching genesis block for Org1 ---'
    peer channel fetch 0 /tmp/channel genesis.block \
        -o orderer.ai-coordination.com:7050 \
        -c $CHANNEL_NAME \
        --tls --cafile \$ORDERER_CA 2>&1 || true

    echo '--- Joining peer0.org1 to channel ---'
    peer channel join -b /tmp/channel genesis.block \
        --tls --cafile \$ORDERER_CA 2>&1 || peer channel join -b genesis.block \
        --tls --cafile \$ORDERER_CA 2>&1 || echo 'Join may have failed for Org1'
" 2>&1 || warn "Org1 join step had issues"

docker exec cli bash -c "
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org2MSP
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/network/crypto-config/peerOrganizations/org2.ai-coordination.com/users/Admin@org2.ai-coordination.com/msp
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/network/crypto-config/peerOrganizations/org2.ai-coordination.com/peers/peer0.org2.ai-coordination.com/tls/ca.crt
    export CORE_PEER_ADDRESS=peer0.org2.ai-coordination.com:9051
    export ORDERER_CA=/opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt

    echo '--- Joining peer0.org2 to channel ---'
    peer channel join -b genesis.block \
        --tls --cafile \$ORDERER_CA 2>&1 || echo 'Join may have failed for Org2'
" 2>&1 || warn "Org2 join step had issues"

# ── Step 5: Deploy chaincode ───────────────────────────────────────
info "═══ Step 5/5: Deploying chaincode ═══"

docker exec cli bash -c "
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/network/crypto-config/peerOrganizations/org1.ai-coordination.com/users/Admin@org1.ai-coordination.com/msp
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/network/crypto-config/peerOrganizations/org1.ai-coordination.com/peers/peer0.org1.ai-coordination.com/tls/ca.crt
    export CORE_PEER_ADDRESS=peer0.org1.ai-coordination.com:7051
    export ORDERER_CA=/opt/gopath/src/network/crypto-config/ordererOrganizations/ai-coordination.com/orderers/orderer.ai-coordination.com/tls/ca.crt

    echo '--- Packaging chaincode ---'
    peer lifecycle chaincode package /tmp/${CHAINCODE_LABEL}.tar.gz \
        --path /opt/gopath/src/chaincode \
        --lang golang \
        --label $CHAINCODE_LABEL 2>&1

    echo '--- Installing on peer0.org1 ---'
    peer lifecycle chaincode install /tmp/${CHAINCODE_LABEL}.tar.gz 2>&1

    echo '--- Getting package ID ---'
    peer lifecycle chaincode queryinstalled 2>&1

    echo '--- Installing on peer0.org2 ---'
    export CORE_PEER_LOCALMSPID=Org2MSP
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/network/crypto-config/peerOrganizations/org2.ai-coordination.com/users/Admin@org2.ai-coordination.com/msp
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/network/crypto-config/peerOrganizations/org2.ai-coordination.com/peers/peer0.org2.ai-coordination.com/tls/ca.crt
    export CORE_PEER_ADDRESS=peer0.org2.ai-coordination.com:9051

    peer lifecycle chaincode
