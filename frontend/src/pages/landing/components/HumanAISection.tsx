import React from 'react';
import { C, UI } from '../constants';
import { Stethoscope, ArrowRight, Microchip } from 'lucide-react';

export default function HumanAISection() {
  return (
    <section style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        
        <div className="reveal-stagger" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.sage, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
          Philosophy
        </div>
        
        <h2 className="reveal-stagger" style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: C.primary, marginBottom: 24, lineHeight: 1.05 }}>
          AI <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage }}>assists.</span><br/>
          Clinicians <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage }}>decide.</span>
        </h2>
        
        <p className="reveal-stagger" style={{ fontSize: 18, color: C.muted, fontWeight: 500, lineHeight: 1.6, marginBottom: 64 }}>
          MedAgentOS is not designed to replace medical professionals. It is engineered to synthesize vast amounts of data, surface critical evidence, and present a mathematically verified consensus for final human approval.
        </p>

        <div className="reveal-stagger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          
          <div style={{ background: C.surface, padding: '24px 32px', borderRadius: '12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.03)' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(143,160,140,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Microchip size={24} color={C.sage} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: C.muted }}>STEP 01</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>AI Synthesis</div>
            </div>
          </div>

          <ArrowRight size={24} color={C.border} />

          <div style={{ background: C.primary, padding: '24px 32px', borderRadius: '12px', color: '#fff', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 12px 32px rgba(37,40,35,0.15)' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Stethoscope size={24} color="#fff" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: C.sage }}>STEP 02</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Clinician Review</div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
