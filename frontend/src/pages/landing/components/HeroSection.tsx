import React from 'react';
import { useNavigate } from 'react-router-dom';
import { C, UI } from '../constants';
import { Shield, Brain, Network, Lock, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section style={{
      position: 'relative', minHeight: '100vh', paddingTop: 140, paddingBottom: 80,
      display: 'flex', alignItems: 'center', overflow: 'hidden', fontFamily: UI.fonts.sans,
      background: C.bg
    }}>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 64, alignItems: 'center' }}>

          {/* Left: Copy */}
          <div className="reveal-stagger" style={{ maxWidth: 640 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 32,
              background: 'rgba(143,160,140,0.15)', borderRadius: '4px',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              color: C.deep, textTransform: 'uppercase', border: `1px solid rgba(143,160,140,0.3)`
            }}>
              <Brain size={14} /> AI-Powered Clinical Decision Support
            </div>

            <h1 style={{ fontSize: 'clamp(48px, 5vw, 68px)', lineHeight: 1.05, fontWeight: 900, color: C.primary, letterSpacing: '-0.03em' }}>
              Clinical intelligence,<br />
              built to be <span style={{ fontFamily: UI.fonts.serif, fontStyle: 'italic', color: C.sage, fontWeight: 500 }}>trusted.</span>
            </h1>

            <p style={{ marginTop: 32, color: C.muted, fontSize: 18, lineHeight: 1.6, maxWidth: 540, fontWeight: 500 }}>
              Specialized AI agents reason across clinical data, evidence, and risk while every important decision can be verified through cryptographic provenance.
            </p>

            <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 24 }}>
              <button onClick={() => navigate('/login')} style={{
                background: C.primary, color: C.surface, padding: '18px 36px', fontSize: 15, fontWeight: 700,
                border: 'none', cursor: 'pointer', borderRadius: '4px', fontFamily: UI.fonts.sans,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 8px 24px rgba(37,40,35,0.15)', transition: 'all 0.2s',
              }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                Enter Clinical Platform <ArrowRight size={18} />
              </button>
              
              <a href="#architecture" style={{
                color: C.primary, fontSize: 15, fontWeight: 700, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'color 0.2s'
              }} onMouseEnter={(e) => e.currentTarget.style.color = C.sage} onMouseLeave={(e) => e.currentTarget.style.color = C.primary}>
                Explore Architecture
              </a>
            </div>
            
            <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 32, borderTop: `1px solid ${C.border}`, paddingTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Shield size={20} color={C.sage} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HIPAA Compliant</div>
                  <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Zero-Knowledge Proofs</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Lock size={20} color={C.sage} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cryptographic Trust</div>
                  <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Hyperledger Fabric</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Abstract System Visual */}
          <div className="reveal-stagger" style={{ position: 'relative', height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Base Clinical Image inside an architectural frame */}
            <div style={{
              position: 'absolute', width: '80%', height: '85%', right: 0, top: '5%',
              background: '#e5e7eb', borderRadius: '8px', overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(37,40,35,0.1)', border: `1px solid ${C.borderLight}`
            }}>
              <img src="/hero_clinical_ai.jpg" alt="Clinical Environment" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(45deg, ${C.primary} 0%, transparent 100%)`, opacity: 0.4 }} />
            </div>

            {/* Floating Cards */}
            <div style={{ position: 'absolute', top: '15%', left: '-10%', animation: 'float 6s ease-in-out infinite' }}>
              <div style={{ background: C.surface, padding: '16px 20px', borderRadius: '6px', boxShadow: '0 12px 32px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, background: 'rgba(143,160,140,0.15)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Network size={20} color={C.sage} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.primary, lineHeight: 1 }}>10</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>Specialized Agents</div>
                </div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: '25%', left: '-5%', animation: 'float 7s ease-in-out infinite reverse' }}>
              <div style={{ background: C.surface, padding: '16px 20px', borderRadius: '6px', boxShadow: '0 12px 32px rgba(0,0,0,0.08)', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={16} color={C.success} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: C.primary }}>VERIFIED</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Cryptographic provenance</div>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '10%', right: '10%', animation: 'float 8s ease-in-out infinite 1s' }}>
              <div style={{ background: C.primary, padding: '16px 20px', borderRadius: '6px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', border: `1px solid rgba(255,255,255,0.1)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>FABRIC</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Permissioned Ledger</div>
                </div>
              </div>
            </div>

            {/* Connection lines SVG overlay */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.3 }} z-index="2">
              <path d="M100,200 Q200,300 350,250" fill="none" stroke={C.sage} strokeWidth="2" strokeDasharray="4 4" />
              <path d="M150,450 Q250,350 400,500" fill="none" stroke={C.sage} strokeWidth="2" strokeDasharray="4 4" />
            </svg>

          </div>
        </div>
      </div>
      
      {/* CSS Keyframes injected here for the floating animation */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </section>
  );
}
