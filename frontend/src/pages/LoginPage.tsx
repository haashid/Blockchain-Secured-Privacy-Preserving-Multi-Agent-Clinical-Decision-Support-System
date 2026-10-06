import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, User, ShieldCheck, Brain, Blocks, ArrowRight, AlertCircle } from 'lucide-react';
import { authApi } from '../lib/api';

const highlights = [
  { icon: Brain,       title: 'Multi-Agent Reasoning',  text: 'Ten specialized clinical agents collaborating on every case.' },
  { icon: Blocks,      title: 'Blockchain Provenance',   text: 'Every AI decision hashed and anchored on a Hyperledger ledger.' },
  { icon: ShieldCheck, title: 'Cryptographic Trust',     text: 'SHA-256 integrity, consensus scoring, and tamper detection.' },
];

const demos = [
  { role: 'Admin',   user: 'admin',   pass: 'admin123' },
  { role: 'Doctor',  user: 'doctor',  pass: 'doctor123' },
  { role: 'Patient', user: 'patient', pass: 'patient123' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('user_role', res.role || 'admin');
      const role = res.role || 'admin';
      if (role === 'doctor') navigate('/doctor/dashboard');
      else if (role === 'patient') navigate('/patient/dashboard');
      else navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[55%] bg-[var(--color-clinical-950)] text-white flex-col justify-between p-14 relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[var(--accent-primary)]/20 to-transparent rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Brand */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center shadow-lg shadow-[var(--accent-primary)]/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-xl tracking-tight text-white leading-none">
              MedAgent<span className="text-[var(--accent-primary)]">OS</span>
            </p>
            <p className="text-[10px] tracking-widest text-[var(--color-clinical-400)] font-bold uppercase mt-1">
              Clinical AI Platform
            </p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 max-w-lg mt-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-full mb-6">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-bold tracking-widest text-[var(--accent-primary)] uppercase">
              AI-Powered Decision Support
            </span>
          </div>

          <h1 className="text-5xl leading-[1.1] font-bold text-white tracking-tight">
            Clinical decisions you can <span className="text-[var(--accent-primary)] font-semibold italic">cryptographically</span> trust.
          </h1>

          <p className="mt-6 text-[var(--color-clinical-300)] text-lg leading-relaxed font-medium">
            A blockchain-secured multi-agent platform where specialized clinical AI agents collaborate, verify each other, and anchor every conclusion on an immutable ledger.
          </p>

          <div className="mt-12 flex flex-col gap-4">
            {highlights.map((h) => (
              <div key={h.title} className="flex items-start gap-4 p-5 bg-[var(--color-clinical-900)]/80 border border-[var(--color-clinical-800)] rounded-xl backdrop-blur-md">
                <div className="w-10 h-10 bg-[var(--color-clinical-800)] rounded-lg flex items-center justify-center shrink-0 border border-[var(--color-clinical-700)]">
                  <h.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{h.title}</p>
                  <p className="text-[13px] text-[var(--color-clinical-400)] mt-1.5 leading-relaxed font-medium">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] font-bold text-[var(--color-clinical-500)] uppercase tracking-widest mt-12">
          ⚕ Decision-support only — all outputs require clinician review.
        </p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--color-clinical-50)]">
        <div className="w-full max-w-[420px]">
          
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-xl tracking-tight text-[var(--text-primary)]">
              MedAgent<span className="text-[var(--accent-primary)]">OS</span>
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Welcome back</h2>
            <p className="text-[15px] text-[var(--text-secondary)] mt-2 font-medium">Sign in to your clinical workspace.</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleLogin} className="mt-8 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-[var(--border-subtle)]">
            
            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 rounded-xl text-[var(--status-danger)] text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-widest">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username" autoComplete="username" required
                  className="w-full bg-[var(--color-clinical-50)] border border-[var(--border-strong)] text-[var(--text-primary)] pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-8">
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  className="w-full bg-[var(--color-clinical-50)] border border-[var(--border-strong)] text-[var(--text-primary)] pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[var(--text-primary)] hover:bg-[var(--accent-primary)] text-white py-4 rounded-xl text-sm font-bold tracking-wide transition-colors">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <> Sign In <ArrowRight className="w-4 h-4" /> </>
              )}
            </button>

            {/* Quick access */}
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-widest font-bold mb-4">
                Quick Access
              </p>
              <div className="grid grid-cols-3 gap-3">
                {demos.map(d => (
                  <button key={d.user} type="button"
                    onClick={() => { setUsername(d.user); setPassword(d.pass); }}
                    className="flex flex-col items-center justify-center py-3 px-2 bg-[var(--color-clinical-50)] border border-[var(--border-strong)] rounded-lg hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all group"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">{d.role}</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{d.pass}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Footer trust */}
          <div className="flex items-center justify-center gap-2 mt-8 opacity-70">
            <ShieldCheck className="w-4 h-4 text-[var(--text-secondary)]" />
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              Secured by Hyperledger · SHA-256
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
