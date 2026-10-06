import React from 'react';
import { C, UI } from '../constants';

export default function PrinciplesSection() {
  const principles = [
    { num: '01', title: 'Specialization', desc: 'No single monolithic model. A network of narrowly scoped, expert agents.' },
    { num: '02', title: 'Least Privilege', desc: 'Agents receive only the exact context required for their specific clinical task.' },
    { num: '03', title: 'Evidence Grounding', desc: 'Every claim is cross-referenced against authoritative medical literature.' },
    { num: '04', title: 'Cryptographic Integrity', desc: 'Inputs and outputs are mathematically hashed to prevent silent tampering.' },
    { num: '05', title: 'Permissioned Provenance', desc: 'The ledger is strictly permissioned; consensus is public to the network, data is not.' },
    { num: '06', title: 'Human Oversight', desc: 'The system proposes and proves. The clinician reviews and approves.' }
  ];

  return (
    <section style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
        
        <div className="reveal-stagger" style={{ textAlign: 'center', marginBottom: 80, maxWidth: 640, margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 900, color: C.primary, marginBottom: 16, lineHeight: 1.1 }}>
            Built around six engineering principles.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40 }}>
          {principles.map(p => (
            <div key={p.num} className="reveal-stagger" style={{ borderTop: `2px solid ${C.primary}`, paddingTop: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.sage, marginBottom: 16 }}>{p.num}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: C.primary, marginBottom: 12 }}>{p.title}</h3>
              <p style={{ fontSize: 15, color: C.muted, fontWeight: 500, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
