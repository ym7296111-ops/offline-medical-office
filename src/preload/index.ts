import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  patients: {
    create: (input: any) => ipcRenderer.invoke('patients:create', input),
    list: () => ipcRenderer.invoke('patients:list'),
  },
  insurance: {
    create: (input: any) => ipcRenderer.invoke('insurance:create', input),
    list: () => ipcRenderer.invoke('insurance:list'),
    toggle: (id: number) => ipcRenderer.invoke('insurance:toggle', id),
  },
  entities: {
    create: (input: any) => ipcRenderer.invoke('entities:create', input),
    list: () => ipcRenderer.invoke('entities:list'),
    toggle: (id: number) => ipcRenderer.invoke('entities:toggle', id),
  },
  visits: {
    create: (input: any) => ipcRenderer.invoke('visits:create', input),
    get: (id: number) => ipcRenderer.invoke('visits:get', id),
    listActive: (searchTerm?: string) => ipcRenderer.invoke('visits:listActive', searchTerm),
    discharge: (visitId: number, dischargeDate: string) =>
      ipcRenderer.invoke('visits:discharge', visitId, dischargeDate),
    getReport: (visitId: number) => ipcRenderer.invoke('visits:getReport', visitId),
  },
  procedures: {
    list: () => ipcRenderer.invoke('procedures:list'),
    listAll: () => ipcRenderer.invoke('procedures:listAll'),
    create: (input: any) => ipcRenderer.invoke('procedures:create', input),
    toggle: (id: number) => ipcRenderer.invoke('procedures:toggle', id),
  },
  visitProcedures: {
    add: (input: any) => ipcRenderer.invoke('visit_procedures:add', input),
    listByVisit: (visitId: number) => ipcRenderer.invoke('visit_procedures:listByVisit', visitId),
    delete: (id: number) => ipcRenderer.invoke('visit_procedures:delete', id),
  }
});
