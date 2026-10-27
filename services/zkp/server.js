const express = require('express');
const cors = require('cors');
const bbs = require('./bbs_service');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/issue', async (req, res) => {
    try {
        const claims = req.body;
        // Validate required claims are present
        for (const key of bbs.CLAIM_KEYS) {
            if (claims[key] === undefined || claims[key] === null) {
                return res.status(400).json({ error: `Missing required claim: ${key}` });
            }
        }
        
        const result = await bbs.issueCredential(claims);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/derive-proof', async (req, res) => {
    try {
        const { signature, claims, nonce, revealed_indices } = req.body;
        if (!signature || !claims || !nonce || !revealed_indices) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        
        const proof = await bbs.createProof(signature, claims, nonce, revealed_indices);
        res.json({ proof });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/verify-proof', async (req, res) => {
    try {
        const { proof, revealed_claims, nonce } = req.body;
        if (!proof || !revealed_claims || !nonce) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        
        const result = await bbs.verifyProof(proof, revealed_claims, nonce);
        res.json({ verified: result.verified, error: result.error?.message });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/public-key', async (req, res) => {
    try {
        const keyPair = await bbs.ensureKeyPair();
        res.json({ publicKey: Buffer.from(keyPair.publicKey).toString('base64') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`ZKP Node Service running on port ${PORT}`);
    await bbs.ensureKeyPair();
    console.log("Issuer key pair initialized.");
});
