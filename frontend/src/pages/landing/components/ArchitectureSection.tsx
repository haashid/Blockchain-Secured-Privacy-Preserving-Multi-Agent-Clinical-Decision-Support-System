import React, { useState } from 'react';
import { C, UI } from '../constants';

export default function ArchitectureSection() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  const layers = [
    { id: 'user', label: 'USER', details: 'Patients, Doctors, Administrators' },
    { id: 'app', label: 'APPLICATION', details: 'React + Vite Frontend' },
    { id: 'identity', label: 'IDENTITY', details: 'Decentralized Identifiers & Verifiable Credentials' },
    { id: 'ehr', label: 'EHR INTERFACE', details: 'FHIR Integration & Consent Management' },
    { id: 'ai', label: 'AI ORCHESTRATION', details: 'Supervisor, Specialists, Critic, Verifier' },
    { id: 'rag', label: 'RAG & EVIDENCE', details: 'Vector DB & Medical Literature Retrieval' },
    { id: 'crypto', label: 'CRYPTOGRAPHY', details: 'ZKP, PQC, AES-GCM, SHA-256' },
    { id: 'storage', label: 'STORAGE', details: 'Encrypted Object Storage (MinIO)' },
    { id: 'blockchain', label: 'BLOCKCHAIN', details: 'Hyperledger Fabric Ledger & Chaincode' }
  ];

  return (
    <section id="architecture" style={{ padding: '120px 0', background: '#fff', fontFamily: UI.fonts.sans }}>
      <div style={{ maxWidth: UI.maxWidth, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div className="reveal-stagger" style={{ textAlign: 'center', marginBottom: 64, maxWidth: 640 }}>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 900, color: C.primary, marginBottom: 16, lineHeight: 1.1 }}>
            Full-Stack Architecture
          </h2>
          <p style={{ fontSize: 16, color: C.muted, fontWeight: 500 }}>
            Hover over any layer to see how our systems integrate.
          </p>
        </div>

        <div className="reveal-stagger" style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {layers.map(layer => (
            <div 
              key={layer.id}
              onMouseEnter={() => setActiveLayer(layer.id)}
              onMouseLeave={() => setActiveLayer(null)}
              style={{ 
                background: activeLayer === layer.id ? C.primary : C.surface, 
                color: activeLayer === layer.id ? '#fff' : C.primary,
                border: `1px solid ${activeLayer === layer.id ? C.primary : C.border}`,
                padding: '20px 32px', 
                borderRadius: '8px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.2s',
                cursor: 'default'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.15em' }}>
                {layer.label}
              </div>
              <div style={{ 
                fontSize: 13, fontWeight: 600, 
                color: activeLayer === layer.id ? C.sage : C.muted,
                opacity: activeLayer === layer.id ? 1 : 0,
                transform: activeLayer === layer.id ? 'translateX(0)' : 'translateX(10px)',
                transition: 'all 0.3s'
              }}>
                {layer.details}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
