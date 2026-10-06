import React from 'react';
import { C, UI } from '../constants';
import { Database, Filter, ArrowRight } from 'lucide-react';

export default function EHRSection() {
  return (
    <section style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
        
        <div className="reveal-stagger" style={{ textAlign: 'center', marginBottom: 64, maxWidth: 640, margin: '0 auto 64px' }}>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 900, color: C.primary, marginBottom: 16, lineHeight: 1.1 }}>
            Clinical data stays where it belongs.
          </h2>
          <p style={{ fontSize: 16, color: C.muted, fontWeight: 500, lineHeight: 1.6 }}>
            Raw clinical records never go onto the blockchain. The platform extracts the minimum necessary context and processes it ephemerally within authorized enclaves.
          </p>
        </div>

        <div className="reveal-stagger" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          
          {/* EHR Source */}
          <div style={{ background: C.surface, padding: 32, borderRadius: '12px', border: `1px solid ${C.border}`, width: '100%', maxWidth: 400, boxShadow: '0 12px 32px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(143,160,140,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={20} color={C.sage} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>EHR System</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontWeight: 600, color: C.muted }}>
              {['Patient Data', 'Encounter Notes', 'Observations', 'Medications', 'Lab Results', 'Consents'].map(item => (
                <div key={item} style={{ padding: '8px 12px', background: C.bg, borderRadius: '4px', border: `1px solid ${C.borderLight}` }}>
                  ⊢ {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: 2, height: 40, background: C.border }} />

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: C.primary, color: '#fff', borderRadius: '4px' }}>
            <Filter size={18} color={C.sage} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em' }}>MINIMUM NECESSARY DATA EXTRACTION</span>
          </div>

          <div style={{ width: 2, height: 40, background: C.border }} />

          {/* Destination */}
          <div style={{ background: C.surface, padding: 24, borderRadius: '12px', border: `1px dashed ${C.sage}`, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.sage, letterSpacing: '0.1em', marginBottom: 8 }}>SECURE ENCLAVE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>Specialist AI Agent</div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 8, fontWeight: 500 }}>Processes anonymized/filtered context only.</p>
          </div>

        </div>
      </div>
    </section>
  );
}
