import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { privacyApi } from '../../lib/clinicalApi';
import { ShieldCheck, Save, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PatientConsent() {
  const patientId = '00000000-0000-0000-0000-000000000000';
  const queryClient = useQueryClient();
  
  const { data: consent, isLoading } = useQuery({
    queryKey: ['consent', patientId],
    queryFn: () => privacyApi.consent(patientId),
  });

  const { data: availableRoles } = useQuery({
    queryKey: ['availableRoles'],
    queryFn: () => privacyApi.availableRoles(),
  });

  const [emergencyBreakglass, setEmergencyBreakglass] = useState(false);

  // Sync state when loaded
  if (consent && emergencyBreakglass === false && consent.emergency_breakglass) {
    setEmergencyBreakglass(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => privacyApi.updateConsent(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consent', patientId] });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      emergency_breakglass: emergencyBreakglass
    });
  };

  if (isLoading) return <div className="p-8 text-center text-[var(--text-muted)]">Loading consent settings...</div>;

  return (
    <div className="max-w-[800px] mx-auto space-y-8 pb-16 animate-fade-in">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
          Data <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Privacy</span> & Consent
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Manage which AI agents and organizations can access your clinical records.</p>
      </div>

      <div className="panel p-6 space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20">
          <ShieldCheck className="w-6 h-6 text-[var(--status-healthy)] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Cryptographically Enforced</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Your consent preferences are anchored to your Soulbound Token (SBT). Agents cannot access your data without cryptographic authorization.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">Global Settings</h3>
          
          <label className="flex items-start gap-4 p-4 rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-panel-hover)] transition-colors">
            <input 
              type="checkbox" 
              className="mt-1"
              checked={emergencyBreakglass}
              onChange={(e) => setEmergencyBreakglass(e.target.checked)}
            />
            <div>
              <p className="font-bold text-[var(--text-primary)] text-sm">Emergency Break-glass Access</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Allow overriding standard consent policies during critical emergencies (e.g. ICU admissions, unresponsive state). All break-glass events are heavily audited.
              </p>
            </div>
          </label>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">Agent Role Authorizations</h3>
          <div className="grid grid-cols-2 gap-3">
            {availableRoles?.roles?.map(role => {
              const isAllowed = consent?.allowed_roles.includes(role) || consent?.allowed_roles.includes('*');
              return (
                <div key={role} className={cn("p-3 rounded-lg border flex items-center justify-between", isAllowed ? "border-[var(--status-healthy)]/30 bg-[var(--status-healthy)]/5" : "border-[var(--border-subtle)]")}>
                  <span className="text-sm font-medium capitalize text-[var(--text-primary)]">{role.replace('_', ' ')} Agent</span>
                  <span className={cn("text-xs font-bold", isAllowed ? "text-[var(--status-healthy)]" : "text-[var(--text-muted)]")}>
                    {isAllowed ? 'ALLOWED' : 'DENIED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
