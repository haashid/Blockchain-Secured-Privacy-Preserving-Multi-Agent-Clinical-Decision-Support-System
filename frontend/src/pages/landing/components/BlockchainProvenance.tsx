import React from 'react';
import { C, UI } from '../constants';
import { FileSearch, Hash, LockKeyhole, Server, Hexagon } from 'lucide-react';

export default function BlockchainProvenance() {
  return (
    <section style={{ padding: '120px 0', background: C.surface, fontFamily: UI.fonts.sans, overflow: 'hidden' }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        
        <div className="reveal-stagger" style={{ position: 'relative', height: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: `linear-gradient(to bottom, transparent, ${C.sage}, transparent)`, zIndex: 0 }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, zIndex: 1, width: '100%', maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', padding: '12px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <FileSearch size={20} color={C.primary} />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>AI Decision Output</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', padding: '12px 16px', borderRadius: '8px', border: `1px dashed ${C.sage}`, marginLeft: 24 }}>
              <Hash size={20} color={C.sage} />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>SHA-256 Hash Generated</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', padding: '12px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <LockKeyhole size={20} color={C.primary} />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>Encrypted Storage (MinIO)</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: C.primary, color: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
              <Hexagon size={24} color={C.sage} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: C.sage }}>FABRIC GATEWAY</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Anchored to Ledger</div>
              </div>
            </div>
          </div>
        </div>

        <div className="reveal-stagger">
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 48px)', fontWeight: 900, color: C.primary, marginBottom: 24, lineHeight: 1.1 }}>
            Permissioned <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage }}>provenance.</span>
          </h2>
          <p style={{ fontSize: 18, color: C.muted, fontWeight: 500, lineHeight: 1.6, marginBottom: 32 }}>
            Every inference, every retrieved document, and every consensus vote is cryptographically hashed and anchored to a Hyperledger Fabric network.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              'Tamper-evident audit trails for regulatory compliance',
              'Cryptographic proof of what the AI knew at the time of decision',
              'Strict permissioning—only authorized nodes participate'
            ].map((text, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 15, color: C.primary, fontWeight: 600 }}>
                <Server size={18} color={C.sage} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  );
}
