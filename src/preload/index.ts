import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  patients: {
    create: (input: any) => ipcRenderer.invoke('patients:create', input),
    list: () => ipcRenderer.invoke('patients:list'),
  }
});
