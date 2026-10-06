import React, { useEffect, useState } from 'react';
import { C, UI } from '../constants';
import { Activity, CheckCircle2, Loader2, Circle } from 'lucide-react';

export default function LiveWorkflowPreview() {
  const [statuses, setStatuses] = useState({
    supervisor: 'complete',
    history: 'complete',
    risk: 'complete',
    reasoning: 'complete',
    laboratory: 'running',
    evidence: 'running',
    critic: 'waiting'
  });

  // Conceptual animation
  useEffect(() => {
    let t1, t2;
    const animate = () => {
      setStatuses(s => ({ ...s, laboratory: 'running', evidence: 'running', critic: 'waiting' }));
      t1 = setTimeout(() => {
        setStatuses(s => ({ ...s, laboratory: 'complete', evidence: 'complete', critic: 'running' }));
        t2 = setTimeout(() => {
          setStatuses(s => ({ ...s, critic: 'complete' }));
        }, 2000);
      }, 2500);
    };
    
    // Create an intersection observer to trigger it when visible
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) animate();
    }, { threshold: 0.5 });
    
    const el = document.getElementById('live-preview');
    if (el) observer.observe(el);
    
    return () => {
      if (el) observer.unobserve(el);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    if (status === 'complete') return <CheckCircle2 size={16} color={C.success} />;
    if (status === 'running') return <Loader2 size={16} color={C.warning} className="animate-spin" />;
    return <Circle size={16} color={C.muted} />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'complete') return C.success;
    if (status === 'running') return C.warning;
    return C.muted;
  };

  return (
    <section id="live-preview" style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div className="reveal-stagger" style={{ textAlign: 'center', marginBottom: 48, maxWidth: 600 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.sage, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            <Activity size={16} /> Workflow Preview
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: C.primary, marginBottom: 16, lineHeight: 1.1 }}>Active Intelligence System</h2>
          <p style={{ fontSize: 16, color: C.muted, fontWeight: 500 }}>
            Experience how the agent network processes clinical inputs asynchronously in real-time.
          </p>
        </div>

        <div className="reveal-stagger" style={{ width: '100%', maxWidth: 700, background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(37,40,35,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', background: C.primary, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: C.sage, marginBottom: 4 }}>CASE-001</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Clinical Review</div>
            </div>
            <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>
              SIMULATION
            </div>
          </div>
          
          <div style={{ padding: '16px 0' }}>
            {Object.entries(statuses).map(([agent, status], idx) => (
              <div key={agent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: idx < Object.keys(statuses).length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, textTransform: 'capitalize' }}>
                  {agent}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: getStatusColor(status), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {getStatusIcon(status)} {status}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
