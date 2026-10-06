import React, { useEffect, useState } from 'react';
import { C, UI } from '../constants';
import { Activity } from 'lucide-react';

export default function AgentWorkflowPreview() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    'Clinical Context', 'Supervisor', 'Specialists', 'Evidence', 'Critic', 'Verification', 'Human Review', 'Provenance'
  ];

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById('workflow-section');
      if (section) {
        const rect = section.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, 1 - (rect.bottom - window.innerHeight) / (rect.height)));
        const step = Math.floor(progress * (steps.length + 1));
        setActiveStep(Math.min(step, steps.length - 1));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="workflow-section" style={{ minHeight: '150vh', background: C.surface, fontFamily: UI.fonts.sans, position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px', width: '100%', display: 'flex', gap: 64, alignItems: 'center' }}>
          
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, color: C.primary, marginBottom: 24, lineHeight: 1.1 }}>
              From patient context<br/>
              to <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage }}>verified clinical insight.</span>
            </h2>
            <p style={{ fontSize: 18, color: C.muted, fontWeight: 500, maxWidth: 400 }}>
              The MedAgentOS pipeline enforces a zero-trust model at every stage of the intelligence lifecycle.
            </p>
          </div>

          <div style={{ flex: 1, position: 'relative', height: 600, display: 'flex', alignItems: 'center' }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', left: 24, top: 0, bottom: 0, width: 2, background: C.border }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40, width: '100%' }}>
              {steps.map((step, idx) => {
                const isActive = idx === activeStep;
                const isPast = idx < activeStep;
                return (
                  <div key={idx} style={{ 
                    display: 'flex', alignItems: 'center', gap: 32, 
                    opacity: isActive || isPast ? 1 : 0.3,
                    transform: isActive ? 'translateX(12px) scale(1.05)' : 'translateX(0)',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    <div style={{ 
                      width: 50, height: 50, borderRadius: '50%', background: isActive ? C.primary : (isPast ? C.sage : C.bg),
                      border: `2px solid ${isActive ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive || isPast ? '#fff' : C.muted, fontSize: 14, fontWeight: 800, zIndex: 1
                    }}>
                      0{idx + 1}
                    </div>
                    <div style={{ flex: 1, background: isActive ? '#fff' : 'transparent', padding: isActive ? '16px 24px' : '8px 0', borderRadius: '8px', boxShadow: isActive ? '0 12px 32px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.3s' }}>
                      <h4 style={{ fontSize: 20, fontWeight: 800, color: isActive ? C.primary : C.muted }}>{step}</h4>
                      {isActive && <p style={{ fontSize: 13, color: C.muted, marginTop: 4, fontWeight: 500 }}>System processing and enforcing constraints for {step.toLowerCase()}.</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
