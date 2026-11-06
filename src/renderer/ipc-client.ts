declare global {
  interface Window {
    api: {
      patients: {
        create: (input: any) => Promise<any>;
        list: () => Promise<any>;
      }
    }
  }
}

export async function createPatient(input: any) {
  const res = await window.api.patients.create(input);
  if (!res.success) throw new Error(res.error.message);
  return res.data;
}

export async function listPatients() {
  const res = await window.api.patients.list();
  if (!res.success) throw new Error(res.error.message);
  return res.data;
}
