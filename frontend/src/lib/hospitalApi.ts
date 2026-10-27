import { request } from './api';

const H_BASE = '/hospital';

export const patientsApi = {
    list: () => request<any[]>(`${H_BASE}/patients`),
    get: (id: string) => request<any>(`${H_BASE}/patients/${id}`),
    create: (data: any) => request<any>(`${H_BASE}/patients`, { method: 'POST', body: JSON.stringify(data) }),
    myRecord: () => request<any>(`${H_BASE}/me/patient`),
    clinicalSummary: (id: string) => request<any>(`${H_BASE}/patients/${id}/clinical-summary`),
};

export const doctorsApi = {
    list: () => request<any[]>(`${H_BASE}/doctors`),
    get: (id: string) => request<any>(`${H_BASE}/doctors/${id}`),
    create: (data: any) => request<any>(`${H_BASE}/doctors`, { method: 'POST', body: JSON.stringify(data) }),
    myDoctor: () => request<any>(`${H_BASE}/me/doctor`),
};

export const appointmentsApi = {
    list: (params?: { doctorId?: string; patientId?: string; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.doctorId) q.append('doctor_id', params.doctorId);
        if (params?.patientId) q.append('patient_id', params.patientId);
        if (params?.status) q.append('status', params.status);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return request<any[]>(`${H_BASE}/appointments${qs}`);
    },
    updateStatus: (id: string, status: string, notes?: string) =>
        request<any>(`${H_BASE}/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
    forDoctor: (doctorId: string) => request<any[]>(`${H_BASE}/doctors/${doctorId}/appointments`),
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/appointments`),
    myAppointments: () => request<any[]>(`${H_BASE}/me/appointments`),
    create: (data: any) => request<any>(`${H_BASE}/appointments`, { method: 'POST', body: JSON.stringify(data) }),
};

export const recordsApi = {
    list: (params?: { patientId?: string; doctorId?: string; recordType?: string }) => {
        const q = new URLSearchParams();
        if (params?.patientId) q.append('patient_id', params.patientId);
        if (params?.doctorId) q.append('doctor_id', params.doctorId);
        if (params?.recordType) q.append('record_type', params.recordType);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return request<any[]>(`${H_BASE}/records${qs}`);
    },
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/records`),
    create: (data: any) => request<any>(`${H_BASE}/records`, { method: 'POST', body: JSON.stringify(data) }),
};

export const prescriptionsApi = {
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/prescriptions`),
    myPrescriptions: () => request<any[]>(`${H_BASE}/prescriptions`),
};

export const analysisApi = {
    request: (patientId: string, data: any) => request<any>(`${H_BASE}/patients/${patientId}/analyze`, { method: 'POST', body: JSON.stringify(data) }),
    getTask: (taskId: string) => request<any>(`/tasks/${taskId}`),
};

export const reportsApi = {
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/reports`),
    upload: (patientId: string, file: File, description: string = '') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);
        return request<any>(`${H_BASE}/patients/${patientId}/reports`, {
            method: 'POST',
            body: formData as any,
        }, true);
    },
    delete: (reportId: string) => request<any>(`${H_BASE}/reports/${reportId}`, { method: 'DELETE' }),
};
