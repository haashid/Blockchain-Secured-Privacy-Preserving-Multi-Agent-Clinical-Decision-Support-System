const {
  generateBls12381G2KeyPair,
  blsSign,
  blsVerify,
  blsCreateProof,
  blsVerifyProof,
} = require("@mattrglobal/bbs-signatures");
const fs = require('fs');
const path = require('path');

let issuerKeyPair = null;

// Claim order MUST be strictly enforced:
// 0: credential_id
// 1: agent_did
// 2: organization
// 3: role
// 4: capabilities
// 5: issued_at
// 6: expiration
const CLAIM_KEYS = [
    "credential_id",
    "agent_did",
    "organization",
    "role",
    "capabilities",
    "issued_at",
    "expiration"
];

function ensureKeyPair() {
    return new Promise(async (resolve, reject) => {
        try {
            if (issuerKeyPair) return resolve(issuerKeyPair);
            
            const keyPath = path.join(__dirname, 'issuer_key.json');
            if (fs.existsSync(keyPath)) {
                const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                issuerKeyPair = {
                    publicKey: new Uint8Array(Buffer.from(data.publicKey, 'base64')),
                    secretKey: new Uint8Array(Buffer.from(data.secretKey, 'base64'))
                };
            } else {
                issuerKeyPair = await generateBls12381G2KeyPair();
                fs.writeFileSync(keyPath, JSON.stringify({
                    publicKey: Buffer.from(issuerKeyPair.publicKey).toString('base64'),
                    secretKey: Buffer.from(issuerKeyPair.secretKey).toString('base64')
                }));
            }
            resolve(issuerKeyPair);
        } catch (e) {
            reject(e);
        }
    });
}

function objectToMessages(claims) {
    // strict order enforcement
    return CLAIM_KEYS.map(key => {
        const val = claims[key] || "";
        return new Uint8Array(Buffer.from(String(val)));
    });
}

async function issueCredential(claims) {
    const keyPair = await ensureKeyPair();
    const messages = objectToMessages(claims);
    
    const signature = await blsSign({
        keyPair,
        messages
    });
    
    return {
        signature: Buffer.from(signature).toString('base64'),
        publicKey: Buffer.from(keyPair.publicKey).toString('base64')
    };
}

async function createProof(signatureBase64, claims, nonceBase64, revealedIndices) {
    const keyPair = await ensureKeyPair();
    const messages = objectToMessages(claims);
    const signature = new Uint8Array(Buffer.from(signatureBase64, 'base64'));
    const nonce = new Uint8Array(Buffer.from(nonceBase64, 'base64'));
    
    const proof = await blsCreateProof({
        signature,
        publicKey: keyPair.publicKey,
        messages,
        nonce,
        revealed: revealedIndices
    });
    
    return Buffer.from(proof).toString('base64');
}

async function verifyProof(proofBase64, revealedClaims, nonceBase64) {
    const keyPair = await ensureKeyPair();
    
    // We only pass the revealed messages
    // The library expects an array of Uint8Arrays corresponding to the revealed indices
    const revealedMessages = revealedClaims.map(val => new Uint8Array(Buffer.from(String(val))));
    const proof = new Uint8Array(Buffer.from(proofBase64, 'base64'));
    const nonce = new Uint8Array(Buffer.from(nonceBase64, 'base64'));
    
    const result = await blsVerifyProof({
        proof,
        publicKey: keyPair.publicKey,
        messages: revealedMessages,
        nonce
    });
    
    return result;
}

module.exports = {
    ensureKeyPair,
    issueCredential,
    createProof,
    verifyProof,
    CLAIM_KEYS
};
