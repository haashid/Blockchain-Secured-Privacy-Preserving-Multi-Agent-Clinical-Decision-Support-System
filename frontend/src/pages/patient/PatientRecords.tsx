import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, UploadCloud, Trash2, File, CheckCircle2, ShieldCheck } from 'lucide-react';
import { reportsApi, patientsApi } from '../../lib/hospitalApi';
import { authApi } from '../../lib/api';
import { cn, formatDate } from '../../lib/utils';

export default function PatientRecords() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  
  // Get current user to find their patient ID
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list, enabled: !!user });
  const patient = patients?.find(p => p.email === user?.username + '@example.com') || patients?.[0]; // Fallback for demo
  const patientId = patient?.id;

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', patientId],
    queryFn: () => reportsApi.forPatient(patientId!),
    enabled: !!patientId,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !patientId) throw new Error('Missing file or patient ID');
      return reportsApi.upload(patientId, file, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', patientId] });
      setFile(null);
      setDescription('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', patientId] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 pb-16 stagger">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-black tracking-tight text-white leading-tight">
            Medical <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Records</span>
          </h1>
          <p className="text-[var(--color-text-muted)] text-[13.5px] mt-1.5 font-medium">
            Upload and manage your clinical documents.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="glass-panel p-6 flex flex-col gap-5 h-fit lg:col-span-1 animate-rise">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <UploadCloud className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-[15px] font-bold text-white">Upload New Report</h2>
          </div>
          
          <div className="space-y-4">
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                file ? "border-violet-500/50 bg-violet-500/5" : "border-[var(--color-border)] hover:border-violet-500/30 hover:bg-white/[0.02]"
              )}
            >
              <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {file ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-[13px] font-semibold text-white">{file.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <FileText className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
                  <p className="text-[13px] font-semibold text-white">Click or drag file to upload</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">PDF, JPG, PNG up to 10MB</p>
                </>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Blood Test Results - Sep 2026"
                className="field-input text-[13px]"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <button 
              className="btn-primary w-full"
              disabled={!file || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>

        {/* Documents List */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col animate-rise">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Your Documents</h2>
              <p className="text-[12px] text-[var(--color-text-muted)]">Securely stored on IPFS & Blockchain</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {isLoading ? (
              <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>
            ) : reports?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 border border-dashed border-[var(--color-border)] rounded-xl">
                <File className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
                <p className="text-[13px] font-semibold text-white">No reports uploaded yet</p>
              </div>
            ) : (
              reports?.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-[var(--color-border-subtle)] hover:border-white/10 transition-colors group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-white truncate">{r.filename}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11.5px] text-[var(--color-text-muted)]">{formatDate(r.uploaded_at)}</span>
                        <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                        <span className="text-[11.5px] text-[var(--color-text-muted)]">{(r.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      {r.description && <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 truncate">{r.description}</p>}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
