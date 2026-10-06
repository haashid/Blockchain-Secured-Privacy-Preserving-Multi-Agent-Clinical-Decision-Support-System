import React from 'react';
import { useNavigate } from 'react-router-dom';
import { C, UI } from '../constants';

export default function FAQAndFooter() {
  const navigate = useNavigate();
  const faqs = [
    { q: "What is MedAgentOS?", a: "MedAgentOS is a clinical intelligence platform that uses a multi-agent AI architecture anchored by blockchain provenance to support clinical decision-making securely." },
    { q: "What is a multi-agent clinical system?", a: "Instead of one general AI model, the system uses multiple specialized agents (e.g., Laboratory, History, Risk) that debate and form a consensus, which is verified before being presented to a doctor." },
    { q: "Why use Hyperledger Fabric?", a: "Fabric is a permissioned blockchain, ensuring that clinical provenance and audit trails are immutable and cryptographically verifiable without exposing data to public networks." },
    { q: "Is patient data stored on the blockchain?", a: "No. Patient data remains in encrypted, off-chain storage. Only cryptographic hashes of the decisions and anonymized agent consensus logs are anchored to the blockchain." },
    { q: "How does verification work?", a: "Every agent operation produces a cryptographic signature. A dedicated Verifier agent confirms these signatures and ensures adherence to clinical protocols before the final output is generated." },
    { q: "What is the role of ZKP?", a: "Zero-Knowledge Proofs allow the network to verify that an agent possesses valid credentials or that a patient authorized a workflow, without revealing the underlying sensitive data." },
    { q: "Does the system replace doctors?", a: "No. The system is designed strictly for decision support. It synthesizes complex data and presents verified evidence, but final clinical judgment remains entirely with the human practitioner." },
    { q: "How are AI decisions audited?", a: "Administrators and auditors can trace any AI insight back to its originating evidence, agent votes, and the cryptographic hash anchored on the ledger, providing a complete, tamper-proof history." }
  ];

  return (
    <>
      {/* Final CTA */}
      <section style={{ padding: '120px 0', background: C.surface, fontFamily: UI.fonts.sans, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h2 className="reveal-stagger" style={{ fontSize: 'clamp(36px, 4vw, 48px)', fontWeight: 900, color: C.primary, marginBottom: 24, lineHeight: 1.1 }}>
            Clinical intelligence deserves verifiable infrastructure.
          </h2>
          <p className="reveal-stagger" style={{ fontSize: 18, color: C.muted, fontWeight: 500, lineHeight: 1.6, marginBottom: 48 }}>
            Explore the platform and see how multi-agent reasoning, privacy controls, and blockchain provenance work together.
          </p>
          <div className="reveal-stagger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <button onClick={() => navigate('/login')} style={{
              background: C.primary, color: '#fff', padding: '18px 36px', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer', borderRadius: '4px', fontFamily: UI.fonts.sans,
              boxShadow: '0 8px 24px rgba(37,40,35,0.15)', transition: 'transform 0.2s',
            }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              Enter Platform
            </button>
            <a href="#architecture" style={{
              color: C.primary, fontSize: 15, fontWeight: 700, textDecoration: 'none',
              transition: 'color 0.2s'
            }} onMouseEnter={(e) => e.currentTarget.style.color = C.sage} onMouseLeave={(e) => e.currentTarget.style.color = C.primary}>
              Explore Architecture
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '120px 0', background: C.bg, fontFamily: UI.fonts.sans }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <h2 className="reveal-stagger" style={{ fontSize: 32, fontWeight: 900, color: C.primary, marginBottom: 48, textAlign: 'center' }}>
            Frequently Asked Questions
          </h2>
          <div className="reveal-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {faqs.map((faq, i) => (
              <details key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '20px 24px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16, color: C.primary, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {faq.q} <span style={{ color: C.sage, fontSize: 20 }}>+</span>
                </summary>
                <p style={{ paddingTop: 16, fontSize: 15, color: C.muted, lineHeight: 1.6, fontWeight: 500 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.primary, color: '#fff', padding: '80px 0 40px', fontFamily: UI.fonts.sans }}>
        <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 80 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: C.primary, fontSize: 14, fontWeight: 900 }}>M</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '0.04em' }}>MEDAGENT<span style={{ color: C.sage }}>OS</span></span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                Clinical intelligence platform.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: C.sage, marginBottom: 8 }}>PLATFORM</div>
              <a href="#capabilities" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>Capabilities</a>
              <a href="#architecture" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>Architecture</a>
              <a href="#security" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>Security</a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: C.sage, marginBottom: 8 }}>RESOURCES</div>
              <a href="#" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>Research</a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>Documentation</a>
              <a href="#faq" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>FAQ</a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: C.sage, marginBottom: 8 }}>ACCESS</div>
              <button onClick={() => navigate('/login')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'left', cursor: 'pointer', padding: 0 }}>Sign In</button>
              <a href="#" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success }}></span> System Online
              </a>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 32, fontSize: 14, color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>© {new Date().getFullYear()} MedAgentOS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
