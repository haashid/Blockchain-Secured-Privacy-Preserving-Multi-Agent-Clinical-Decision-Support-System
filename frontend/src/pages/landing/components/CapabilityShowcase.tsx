import React from 'react';
import { C, UI } from '../constants';
import { Network, Database, Fingerprint, Lock, Shield, Link2, ScanFace, Scale } from 'lucide-react';

export default function CapabilityShowcase() {
  return (
    <section id="capabilities" style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
        
        {/* Editorial Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
          
          {/* Large Card: Multi-Agent AI (Span 8) */}
          <div className="reveal-stagger group" style={{ gridColumn: 'span 8', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 40, borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.sage, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                <Network size={16} /> Multi-Agent Orchestration
              </div>
              <h3 style={{ fontSize: 32, fontWeight: 900, color: C.primary, marginBottom: 16, lineHeight: 1.1 }}>Collaborative Clinical Reasoning</h3>
              <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, maxWidth: 500 }}>
                A decentralized network of specialized AI agents analyzing history, laboratory results, medications, and clinical risk in parallel before synthesizing a verified consensus.
              </p>
            </div>
            {/* Visual */}
            <div style={{ flex: 1, background: 'rgba(143,160,140,0.05)', padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ alignSelf: 'center', padding: '12px 24px', background: C.primary, color: '#fff', borderRadius: '4px', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em' }}>SUPERVISOR AGENT</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                  {/* Connecting lines */}
                  <div style={{ position: 'absolute', top: -24, left: '50%', width: 2, height: 24, background: C.sage, opacity: 0.5 }} />
                  <div style={{ position: 'absolute', top: -12, left: '16.6%', right: '16.6%', height: 2, background: C.sage, opacity: 0.5 }} />
                  
                  {['History', 'Labs', 'Risk'].map((specialty, i) => (
                    <div key={i} style={{ padding: '12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', fontSize: 11, fontWeight: 700, color: C.muted, width: '30%', textAlign: 'center', transition: 'all 0.3s' }} className="group-hover:border-sage group-hover:text-primary">
                      {specialty} Agent
                    </div>
                  ))}
                </div>
                <div style={{ alignSelf: 'center', padding: '12px 24px', background: C.surface, border: `1px dashed ${C.sage}`, color: C.sage, borderRadius: '4px', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em' }}>SYNTHESIS & VERIFICATION</div>
              </div>
            </div>
          </div>

          {/* Medium Card: Evidence / RAG (Span 4) */}
          <div className="reveal-stagger group" style={{ gridColumn: 'span 4', background: C.primary, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', color: '#fff' }}>
            <div style={{ padding: 40 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.sage, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                <Database size={16} /> Evidence Grounding
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 16, lineHeight: 1.2 }}>RAG Architecture</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                Retrieval-Augmented Generation ensures every agent conclusion is backed by verified medical literature and specific patient history.
              </p>
            </div>
            <div style={{ flex: 1, padding: 32, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: 20 }}>
                <div style={{ fontSize: 10, color: C.sage, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>EVIDENCE E-004</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Inflammatory Markers</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Relevance Score: 0.93</div>
              </div>
            </div>
          </div>

          {/* Small Card 1: Identity (Span 4) */}
          <div className="reveal-stagger group" style={{ gridColumn: 'span 4', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, padding: 32 }}>
            <Fingerprint size={24} color={C.sage} style={{ marginBottom: 24 }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.primary, marginBottom: 12 }}>Agent Identity</h3>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Every agent possesses a cryptographic Decentralized Identifier (DID) and Verifiable Credentials.
            </p>
            <div style={{ background: C.bg, padding: 12, borderRadius: '4px', fontSize: 11, fontFamily: 'monospace', color: C.primary, border: `1px solid ${C.borderLight}` }}>
              did:key:z6MkhaX...
            </div>
          </div>

          {/* Small Card 2: Privacy (Span 4) */}
          <div className="reveal-stagger group" style={{ gridColumn: 'span 4', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, padding: 32 }}>
            <Lock size={24} color={C.sage} style={{ marginBottom: 24 }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.primary, marginBottom: 12 }}>Privacy & Authorization</h3>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Strict role-based access controls and Zero-Knowledge Proofs (ZKP) to protect sensitive EHR data.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.success }}>
              <Shield size={14} /> AUTHORIZATION VALID
            </div>
          </div>

          {/* Small Card 3: Blockchain (Span 4) */}
          <div className="reveal-stagger group" style={{ gridColumn: 'span 4', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, padding: 32 }}>
            <Link2 size={24} color={C.sage} style={{ marginBottom: 24 }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.primary, marginBottom: 12 }}>Immutable Ledger</h3>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Hyperledger Fabric anchors AI outputs, ensuring a tamper-evident audit trail of clinical provenance.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.primary }}>
              <Scale size={14} /> CHAINCODE VERIFIED
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
