import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { privacyApi } from '../../lib/clinicalApi';
import { patientsApi } from '../../lib/hospitalApi';
import { ShieldCheck, Save, Loader2, AlertTriangle, Key } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PatientConsent() {
  const queryClient = useQueryClient();

  const { data: myPatient } = useQuery({
    queryKey: ['myPatientRecord'],
    queryFn: patientsApi.myRecord,
    retry: false,
  });

  const patientId = myPatient?.id || '00000000-0000-0000-0000-000000000000';
  
  const { data: consent, isLoading } = useQuery({
    queryKey: ['consent', patientId],
    queryFn: () => privacyApi.consent(patientId),
    enabled: !!patientId && patientId !== '00000000-0000-0000-0000-000000000000',
  });

  const { data: availableRoles } = useQuery({
    queryKey: ['availableRoles'],
    queryFn: () => privacyApi.availableRoles(),
  });

  const [emergencyBreakglass, setEmergencyBreakglass] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['*']);

  useEffect(() => {
    if (consent) {
      setEmergencyBreakglass(Boolean(consent.emergency_breakglass));
      if (consent.allowed_roles?.length) {
        setAllowedRoles(consent.allowed_roles);
      }
    }
  }, [consent]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => privacyApi.updateConsent(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consent', patientId] });
      alert('Consent preferences updated and anchored to Soulbound Token!');
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      emergency_breakglass: emergencyBreakglass,
      allowed_roles: allowedRoles,
    });
  };

  const toggleRole = (role: string) => {
    if (allowedRoles.includes('*')) {
      // expand * into all except this one
      const all = availableRoles?.roles || [];
      setAllowedRoles(all.filter(r => r !== role));
    } else if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter(r => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-[var(--text-muted)] text-sm">Loading consent and SBT authorization settings...</div>;
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-6 pb-20 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
          <Key className="w-3.5 h-3.5" /> Self-Sovereign Identity
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Data Privacy & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Consent Control</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Cryptographically enforce which AI specialist agents and clinical organizations are authorized to access your EHR.
        </p>
      </div>

      <div className="panel p-6 space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Soulbound Token (SBT) Anchored</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Your consent choices are cryptographically signed and stored in your non-transferable patient SBT. AI agents cannot bypass these parameters without triggering an automated compliance alert on the Hyperledger audit log.
            </p>
          </div>
        </div>

        {/* Global Emergency Breakglass */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Emergency Access Policy</h3>
          
          <label className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] cursor-pointer hover:border-[var(--accent-primary)] transition-colors">
            <input 
              type="checkbox" 
              className="mt-1 accent-[var(--accent-primary)] w-4 h-4 cursor-pointer"
              checked={emergencyBreakglass}
              onChange={(e) => setEmergencyBreakglass(e.target.checked)}
            />
            <div className="space-y-0.5">
              <p className="font-bold text-[var(--text-primary)] text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Emergency Break-Glass Authorization
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Allow attending emergency clinicians to override standard data restrictions during acute life-threatening emergencies (e.g. cardiac arrest, trauma admission). Every break-glass activation is irreversibly logged with doctor DID.
              </p>
            </div>
          </label>
        </div>

        {/* Agent Role Authorizations */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Multi-Agent Role Permissions</h3>
          <p className="text-xs text-[var(--text-muted)]">Select which specialized AI agents are permitted to process your clinical records:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'clinical_reasoning',
              'medical_history',
              'laboratory',
              'medication',
              'risk',
              'evidence',
              'critic',
              'verifier',
              'synthesizer'
            ].map(role => {
              const isAllowed = allowedRoles.includes('*') || allowedRoles.includes(role);
              return (
                <div
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={cn(
                    "p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all",
                    isAllowed
                      ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                      : "border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]/40 opacity-70 hover:opacity-100"
                  )}
                >
                  <span className="text-xs font-bold capitalize text-[var(--text-primary)]">
                    {role.replace('_', ' ')} Agent
                  </span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", isAllowed ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--bg-panel)] text-[var(--text-muted)]")}>
                    {isAllowed ? 'PERMITTED' : 'RESTRICTED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-end">
          <button 
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Consent Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
