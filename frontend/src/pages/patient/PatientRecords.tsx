import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, UploadCloud, Trash2, File, CheckCircle2, ShieldCheck } from 'lucide-react';
import { reportsApi, patientsApi } from '../../lib/hospitalApi';
import { cn, formatDate } from '../../lib/utils';

export default function PatientRecords() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  
  // Get current patient record
  const { data: myPatient } = useQuery({ queryKey: ['myPatientRecord'], queryFn: patientsApi.myRecord, retry: false });
  const patientId = myPatient?.id;

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
    <div className="max-w-[1200px] mx-auto space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-[var(--text-primary)] leading-tight">
            Medical <span className="text-[var(--accent-primary)]">Records</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-[13.5px] mt-1.5 font-medium">
            Upload and manage your clinical documents, lab reports, and imaging scans.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="panel p-6 flex flex-col gap-5 h-fit lg:col-span-1 border border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <UploadCloud className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Upload New Report</h2>
              <p className="text-xs text-[var(--text-muted)]">Encrypted & signed</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div 
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                file ? "border-violet-500/50 bg-violet-500/5" : "border-[var(--border-strong)] bg-[var(--bg-panel-hover)]/40 hover:bg-[var(--bg-panel-hover)] hover:border-[var(--accent-primary)]"
              )}
            >
              <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {file ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">{file.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <FileText className="w-8 h-8 text-[var(--accent-primary)] mb-2" />
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">Click or drag file to upload</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-medium">PDF, JPG, PNG up to 10MB</p>
                </>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Description (Optional)</label>
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
        <div className="panel p-6 lg:col-span-2 flex flex-col border border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
              <ShieldCheck className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Your Documents</h2>
              <p className="text-[12px] text-[var(--text-muted)]">Securely stored on IPFS & Hyperledger Fabric</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {isLoading ? (
              <p className="text-[var(--text-muted)] text-sm py-4">Loading clinical documents...</p>
            ) : reports?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-[var(--border-subtle)] rounded-xl bg-[var(--bg-panel-hover)]/30 p-6">
                <File className="w-9 h-9 text-[var(--text-muted)] mb-2.5 opacity-60" />
                <p className="text-[14px] font-bold text-[var(--text-primary)]">No reports uploaded yet</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Upload blood work, imaging scans, or clinical notes above.</p>
              </div>
            ) : (
              reports?.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-panel-hover)]/40 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-panel-hover)] transition-all group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-sky-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-[var(--text-primary)] truncate">{r.filename}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11.5px] text-[var(--text-muted)]">{formatDate(r.uploaded_at)}</span>
                        <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                        <span className="text-[11.5px] text-[var(--text-muted)] font-mono">{(r.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      {r.description && <p className="text-[12px] text-[var(--text-secondary)] mt-1 truncate">{r.description}</p>}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                    title="Delete document"
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
