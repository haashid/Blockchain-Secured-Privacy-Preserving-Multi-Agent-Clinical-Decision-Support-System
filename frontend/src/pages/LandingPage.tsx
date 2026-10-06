import React, { useEffect } from 'react';
import LandingNav from './landing/components/LandingNav';
import HeroSection from './landing/components/HeroSection';
import SystemRibbon from './landing/components/SystemRibbon';
import CapabilityShowcase from './landing/components/CapabilityShowcase';
import AgentWorkflowPreview from './landing/components/AgentWorkflowPreview';
import LiveWorkflowPreview from './landing/components/LiveWorkflowPreview';
import SecurityLayers from './landing/components/SecurityLayers';
import EHRSection from './landing/components/EHRSection';
import BlockchainProvenance from './landing/components/BlockchainProvenance';
import HumanAISection from './landing/components/HumanAISection';
import ArchitectureSection from './landing/components/ArchitectureSection';
import PrinciplesSection from './landing/components/PrinciplesSection';
import FAQAndFooter from './landing/components/FAQAndFooter';

function useScrollReveal(selector: string) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    const els = document.querySelectorAll(selector);
    els.forEach((el, index) => {
      // Add a slight transition delay based on DOM order for a stagger effect
      (el as HTMLElement).style.transitionDelay = `${(index % 5) * 0.1}s`;
      observer.observe(el);
    });
    return () => els.forEach((el) => observer.unobserve(el));
  }, [selector]);
}

export default function LandingPage() {
  useScrollReveal('.reveal-stagger');

  return (
    <>
      <style>{`
        body {
          margin: 0;
          font-family: 'Urbanist', 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        html {
          scroll-behavior: smooth;
        }
        .reveal-stagger {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .reveal-stagger.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
      <div style={{ minHeight: '100vh' }}>
        <LandingNav />
        <HeroSection />
        <SystemRibbon />
        <CapabilityShowcase />
        <AgentWorkflowPreview />
        <LiveWorkflowPreview />
        <SecurityLayers />
        <EHRSection />
        <BlockchainProvenance />
        <HumanAISection />
        <ArchitectureSection />
        <PrinciplesSection />
        <FAQAndFooter />
      </div>
    </>
  );
}
