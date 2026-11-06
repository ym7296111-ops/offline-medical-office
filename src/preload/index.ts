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
  },
  procedures: {
    list: () => ipcRenderer.invoke('procedures:list'),
  },
  visitProcedures: {
    add: (input: any) => ipcRenderer.invoke('visit_procedures:add', input),
    listByVisit: (visitId: number) => ipcRenderer.invoke('visit_procedures:listByVisit', visitId),
    delete: (id: number) => ipcRenderer.invoke('visit_procedures:delete', id),
  }
});
