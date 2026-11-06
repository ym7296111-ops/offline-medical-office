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
  }
});
