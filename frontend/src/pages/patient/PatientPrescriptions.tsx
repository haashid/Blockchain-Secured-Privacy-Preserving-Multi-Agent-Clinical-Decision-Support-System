import { useQuery } from '@tanstack/react-query';
import { prescriptionsApi } from '../../lib/hospitalApi';
import { formatDate } from '../../lib/utils';
import {
  Pill, Clock, ShieldCheck, AlertCircle, CheckCircle2
} from 'lucide-react';

export default function PatientPrescriptions() {
  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['myPrescriptions'],
    queryFn: prescriptionsApi.myPrescriptions,
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
          <Pill className="w-3.5 h-3.5" /> Medication Management
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          My <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Prescriptions</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Active medications, dosage instructions, and doctor-prescribed therapies.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-300">Medication Safety Guidance</p>
          <p className="text-amber-100/90 leading-relaxed">
            Always take medications exactly as instructed by your physician. If you experience unexpected side effects, dizziness, or allergic reactions, contact your doctor immediately or visit urgent care.
          </p>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/4 rounded" />
              <div className="skeleton h-12 w-full rounded" />
            </div>
          ))
        ) : !prescriptions || prescriptions.length === 0 ? (
          <div className="panel p-12 text-center flex flex-col items-center justify-center">
            <Pill className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">No Active Prescriptions</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-sm">
              You do not have any active medication orders. Prescriptions issued by your doctor during clinical consultations will appear here.
            </p>
          </div>
        ) : (
          prescriptions.map((script: any) => (
            <div
              key={script.id}
              className="panel p-6 border border-[var(--border-subtle)] hover:border-emerald-500/40 transition-all space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-[var(--text-primary)]">
                      {script.medication_name} <span className="text-emerald-400 text-sm font-bold font-mono">({script.dosage})</span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Prescribed on {formatDate(script.prescribed_at)}
                      <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                      <span>By Dr. Robert Jenkins, MD</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge badge-healthy text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active Regimen
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Frequency</p>
                  <p className="font-bold text-[var(--text-primary)] mt-1">{script.frequency}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Course Duration</p>
                  <p className="font-bold text-[var(--text-primary)] mt-1">{script.duration || '30 days'}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Prescription Status</p>
                  <p className="font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Blockchain Anchored
                  </p>
                </div>
              </div>

              {/* Instructions Box */}
              {script.instructions && (
                <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs space-y-1">
                  <p className="font-bold text-[var(--text-secondary)]">Patient Instructions:</p>
                  <p className="text-[var(--text-primary)] leading-relaxed">{script.instructions}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
