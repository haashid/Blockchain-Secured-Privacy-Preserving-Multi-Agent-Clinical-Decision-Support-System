import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, UI } from '../constants';

export default function LandingNav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 9999,
      padding: scrolled ? '12px 24px' : '24px',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      background: scrolled ? 'rgba(246, 242, 236, 0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
    }}>
      <nav style={{
        maxWidth: UI.maxWidth, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: UI.fonts.sans,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{ width: 28, height: 28, background: C.primary, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: C.bg, fontSize: 14, fontWeight: 900 }}>M</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.primary, letterSpacing: '0.04em' }}>MEDAGENT<span style={{ color: C.sage }}>OS</span></span>
        </div>

        {/* Links */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 40, fontSize: 14, fontWeight: 600, color: C.muted }}>
          <a href="#capabilities" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = C.primary} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>Capabilities</a>
          <a href="#architecture" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = C.primary} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>Architecture</a>
          <a href="#security" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = C.primary} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>Security</a>
          <a href="#faq" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = C.primary} onMouseLeave={(e) => e.currentTarget.style.color = C.muted}>FAQ</a>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/login')} style={{
            background: 'transparent', color: C.primary, padding: '10px 16px', fontSize: 14, fontWeight: 700,
            border: 'none', cursor: 'pointer', fontFamily: UI.fonts.sans,
          }}>Sign In</button>
          
          <button onClick={() => navigate('/login')} style={{
            background: C.primary, color: C.bg, padding: '10px 24px', fontSize: 14, fontWeight: 700,
            border: 'none', cursor: 'pointer', borderRadius: '4px', fontFamily: UI.fonts.sans,
            boxShadow: '0 4px 12px rgba(37,40,35,0.15)', transition: 'transform 0.2s',
          }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            Enter Platform
          </button>
        </div>
      </nav>
    </div>
  );
}
