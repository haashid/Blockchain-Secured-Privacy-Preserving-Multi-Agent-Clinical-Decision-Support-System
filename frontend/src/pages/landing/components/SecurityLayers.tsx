import React from 'react';
import { C, UI } from '../constants';
import { ShieldAlert, ArrowDown } from 'lucide-react';

export default function SecurityLayers() {
  const layers = [
    { label: 'IDENTITY', detail: 'DID & Verifiable Credentials' },
    { label: 'AUTHORIZATION', detail: 'Strict Role-Based Access' },
    { label: 'PRIVACY', detail: 'Zero-Knowledge Proofs (ZKP)' },
    { label: 'ENCRYPTION', detail: 'AES-GCM & Post-Quantum Cryptography (PQC)' },
    { label: 'INTEGRITY', detail: 'SHA-256 Hashing' },
    { label: 'PROVENANCE', detail: 'Hyperledger Fabric Chaincode' }
  ];

  return (
    <section id="security" style={{ padding: '120px 0', background: C.primary, color: '#fff', fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        
        <div className="reveal-stagger">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.sage, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
            <ShieldAlert size={16} /> Cryptographic Defense
          </div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 48px)', fontWeight: 900, marginBottom: 24, lineHeight: 1.1 }}>
            Trust is engineered into the workflow.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: 500, lineHeight: 1.6, maxWidth: 480 }}>
            Every interaction is rigorously authenticated, authorized, encrypted, and recorded. We don't just ask you to trust the AI; we prove its integrity mathematically.
          </p>
        </div>

        <div className="reveal-stagger" style={{ background: 'rgba(255,255,255,0.03)', padding: 48, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {layers.map((layer, idx) => (
            <React.Fragment key={layer.label}>
              <div style={{ width: '100%', padding: '16px 24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center', transition: 'all 0.3s' }} className="hover:border-sage hover:bg-black/40">
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.15em', color: '#fff', marginBottom: 4 }}>{layer.label}</div>
                <div style={{ fontSize: 12, color: C.sage, fontWeight: 600 }}>{layer.detail}</div>
              </div>
              {idx < layers.length - 1 && <ArrowDown size={16} color="rgba(255,255,255,0.2)" />}
            </React.Fragment>
          ))}
        </div>

      </div>
    </section>
  );
}
