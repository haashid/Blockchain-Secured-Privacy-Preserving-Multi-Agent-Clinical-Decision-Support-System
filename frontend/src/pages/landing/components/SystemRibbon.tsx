import React from 'react';
import { C, UI } from '../constants';
import { Database, User, ShieldCheck, Cpu, FileText, CheckCircle, Box } from 'lucide-react';

export default function SystemRibbon() {
  const pipeline = [
    { label: 'EHR', icon: Database },
    { label: 'Identity', icon: User },
    { label: 'Authorization', icon: ShieldCheck },
    { label: 'AI Agents', icon: Cpu },
    { label: 'Evidence', icon: FileText },
    { label: 'Verification', icon: CheckCircle },
    { label: 'Blockchain', icon: Box },
  ];

  return (
    <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '48px 0', fontFamily: UI.fonts.sans, overflow: 'hidden' }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
        
        <div className="reveal-stagger" style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.primary, letterSpacing: '-0.02em' }}>
            One clinical workflow.<br/>
            Multiple layers of <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage }}>intelligence and trust.</span>
          </h2>
        </div>

        <div className="reveal-stagger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {/* Connecting Line */}
          <div style={{ position: 'absolute', top: 24, left: 40, right: 40, height: 2, background: C.borderLight, zIndex: 0 }} />

          {pipeline.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.label} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, height: 48, background: C.bg, borderRadius: '50%', 
                  border: `2px solid ${idx === pipeline.length - 1 ? C.primary : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)', transition: 'transform 0.3s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = C.sage; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = idx === pipeline.length - 1 ? C.primary : C.border; }}>
                  <Icon size={20} color={idx === pipeline.length - 1 ? C.primary : C.sage} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: idx === pipeline.length - 1 ? C.primary : C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
