import { request } from './api';

const H_BASE = '/hospital';

export const patientsApi = {
    list: () => request<any[]>(`${H_BASE}/patients`),
    get: (id: string) => request<any>(`${H_BASE}/patients/${id}`),
    create: (data: any) => request<any>(`${H_BASE}/patients`, { method: 'POST', body: JSON.stringify(data) }),
};

export const doctorsApi = {
    list: () => request<any[]>(`${H_BASE}/doctors`),
    get: (id: string) => request<any>(`${H_BASE}/doctors/${id}`),
    create: (data: any) => request<any>(`${H_BASE}/doctors`, { method: 'POST', body: JSON.stringify(data) }),
};

export const appointmentsApi = {
    forDoctor: (doctorId: string) => request<any[]>(`${H_BASE}/doctors/${doctorId}/appointments`),
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/appointments`), // Note: need route
    create: (data: any) => request<any>(`${H_BASE}/appointments`, { method: 'POST', body: JSON.stringify(data) }),
};

export const recordsApi = {
    forPatient: (patientId: string) => request<any[]>(`${H_BASE}/patients/${patientId}/records`),
    create: (data: any) => request<any>(`${H_BASE}/records`, { method: 'POST', body: JSON.stringify(data) }),
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
            body: formData as any, // fetch will handle FormData automatically
        }, true); // pass true for isFormData if we need to avoid setting content-type
    },
    delete: (reportId: string) => request<any>(`${H_BASE}/reports/${reportId}`, { method: 'DELETE' }),
};
