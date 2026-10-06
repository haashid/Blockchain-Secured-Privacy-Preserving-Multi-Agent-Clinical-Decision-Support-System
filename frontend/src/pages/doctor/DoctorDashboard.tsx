import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../lib/hospitalApi';
import { tasksApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';
import { Users, Brain, Calendar, ArrowRight, ListTodo, Activity, Clock } from 'lucide-react';

function MetricCard({ title, value, icon: Icon, colorClass, to }: any) {
  return (
    <Link to={to} className="panel p-5 group flex flex-col hover:border-[var(--accent-primary)] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-clinical-50)] border border-[var(--border-strong)]`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
      </div>
      <div>
        <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">{title}</p>
      </div>
    </Link>
  );
}

export default function DoctorDashboard() {
  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(5)
  });

  const pendingReports = tasks?.filter(t => t.status !== 'completed').length || 0;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Good morning, <span className="text-[var(--accent-primary)]">Dr. Jenkins</span>
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-2">
            You have 0 upcoming appointments and {pendingReports} pending AI reviews today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-neutral">
            Clinician Session
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricCard 
          title="My Patients" 
          value={patients?.length || 0} 
          icon={Users} 
          colorClass="text-[var(--accent-primary)]" 
          to="/doctor/patients" 
        />
        <MetricCard 
          title="Pending AI Reports" 
          value={pendingReports} 
          icon={Brain} 
          colorClass="text-[var(--status-warning)]" 
          to="/doctor/ai-reports" 
        />
        <MetricCard 
          title="Appointments Today" 
          value={0} 
          icon={Calendar} 
          colorClass="text-[var(--status-healthy)]" 
          to="/doctor/appointments" 
        />
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Schedule */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[var(--color-clinical-100)] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[var(--text-primary)]" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Today's Schedule</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Upcoming patient consultations</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-clinical-100)] flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">No upcoming appointments</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[200px]">Your schedule is clear for the rest of the day.</p>
          </div>
        </div>

        {/* AI Analyses */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[var(--accent-primary)]/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Recent AI Reviews</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Latest multi-agent decision reports</p>
              </div>
            </div>
            <Link to="/doctor/ai-reports" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
              View all
            </Link>
          </div>
          
          <div className="flex flex-col flex-1 divide-y divide-[var(--border-subtle)]">
            {tasks?.slice(0, 5).map(task => (
              <div key={task.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-panel-hover)] transition-colors">
                <div className="min-w-0 pr-4">
                  <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{formatDate(task.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`badge ${task.status === 'completed' ? 'badge-healthy' : 'badge-warning'}`}>
                    {task.status}
                  </span>
                  <Link
                    to={`/admin/tasks/${task.id}`}
                    className="btn-secondary py-1 px-3 text-xs"
                  >
                    View Result
                  </Link>
                </div>
              </div>
            ))}
            {(!tasks || tasks.length === 0) && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--color-clinical-100)] flex items-center justify-center mb-4">
                  <ListTodo className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">No AI analyses requested</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[200px]">You haven't requested any multi-agent reviews yet.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
