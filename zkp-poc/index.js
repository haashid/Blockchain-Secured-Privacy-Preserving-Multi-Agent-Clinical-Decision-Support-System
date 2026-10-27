const {
  generateBls12381G2KeyPair,
  blsSign,
  blsVerify,
  blsCreateProof,
  blsVerifyProof,
} = require("@mattrglobal/bbs-signatures");

async function runBenchmark(name, fn, iterations = 30, warmup = 10) {
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000); // ms
  }
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const stdDev = Math.sqrt(times.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / times.length);
  return { name, min, max, median, mean, stdDev };
}

async function main() {
  console.log("Starting ZKP PoC Validation...");

  // 1. Key generation
  console.log("1. Generating Keys...");
  const keyPair = await generateBls12381G2KeyPair();
  console.log("Public Key:", Buffer.from(keyPair.publicKey).toString("base64").slice(0, 30) + "...");

  // 2. Mocking credential messages
  const messages = [
    new Uint8Array(Buffer.from("did:agent:1234")), // subject
    new Uint8Array(Buffer.from("Cardiology")),     // organization
    new Uint8Array(Buffer.from("doctor")),         // role
    new Uint8Array(Buffer.from("view_history,prescribe")), // capabilities
    new Uint8Array(Buffer.from("2026-10-06T12:00:00Z")), // issued_at
    new Uint8Array(Buffer.from("2027-10-06T12:00:00Z")) // expiration
  ];
  
  // 3. Signing
  console.log("2. Signing credential attributes...");
  const signature = await blsSign({
    keyPair,
    messages,
  });
  console.log("Signature length:", signature.length);

  // 4. Verification
  console.log("3. Verifying signature...");
  const isVerified = await blsVerify({
    publicKey: keyPair.publicKey,
    messages,
    signature,
  });
  console.log("Signature Verified:", isVerified);

  // 5. Selective Disclosure Proof
  console.log("4. Creating Selective Disclosure Proof...");
  const nonce = new Uint8Array(Buffer.from("verifier-challenge-nonce-5678"));
  
  // Let's say the verifier only needs to know role (index 2) and capabilities (index 3), and expiration (index 5)
  const revealedIndices = [2, 3, 5];
  
  const proof = await blsCreateProof({
    signature,
    publicKey: keyPair.publicKey,
    messages,
    nonce,
    revealed: revealedIndices
  });
  console.log("Proof length:", proof.length);

  // 6. Verify Proof
  console.log("5. Verifying Proof...");
  const revealedMessages = [
    new Uint8Array(Buffer.from("doctor")),         // role
    new Uint8Array(Buffer.from("view_history,prescribe")), // capabilities
    new Uint8Array(Buffer.from("2027-10-06T12:00:00Z")) // expiration
  ];

  const isProofVerified = await blsVerifyProof({
    proof,
    publicKey: keyPair.publicKey,
    messages: revealedMessages,
    nonce,
  });
  console.log("Proof Verified:", isProofVerified);

  // 7. Verify Failure (Tampered Attribute)
  const tamperedMessages = [
    new Uint8Array(Buffer.from("admin")),         // Tampered role
    new Uint8Array(Buffer.from("view_history,prescribe")),
    new Uint8Array(Buffer.from("2027-10-06T12:00:00Z"))
  ];
  const isTamperedVerified = await blsVerifyProof({
    proof,
    publicKey: keyPair.publicKey,
    messages: tamperedMessages,
    nonce,
  });
  console.log("Tampered Proof Verification (Expected false):", isTamperedVerified);

  // 8. Verify Failure (Wrong Nonce)
  const wrongNonce = new Uint8Array(Buffer.from("wrong-nonce"));
  const isWrongNonceVerified = await blsVerifyProof({
    proof,
    publicKey: keyPair.publicKey,
    messages: revealedMessages,
    nonce: wrongNonce,
  });
  console.log("Wrong Nonce Proof Verification (Expected false):", isWrongNonceVerified);
  
  // 9. Benchmark
  console.log("\nRunning Benchmarks...");
  
  const bKeyGen = await runBenchmark("KeyGen", async () => await generateBls12381G2KeyPair());
  const bSign = await runBenchmark("Sign", async () => await blsSign({ keyPair, messages }));
  const bVerify = await runBenchmark("VerifySig", async () => await blsVerify({ publicKey: keyPair.publicKey, messages, signature }));
  const bProve = await runBenchmark("CreateProof", async () => await blsCreateProof({ signature, publicKey: keyPair.publicKey, messages, nonce, revealed: revealedIndices }));
  const bVerifyProof = await runBenchmark("VerifyProof", async () => await blsVerifyProof({ proof, publicKey: keyPair.publicKey, messages: revealedMessages, nonce }));
  
  console.table([bKeyGen, bSign, bVerify, bProve, bVerifyProof]);
}

main().catch(console.error);
