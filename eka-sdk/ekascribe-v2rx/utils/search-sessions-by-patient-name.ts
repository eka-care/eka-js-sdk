import { TSessionHistoryData } from '../constants/types';

function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(func(...args));
      }, delay);
    });
  };
}

const searchByName = (sessions: TSessionHistoryData[], patientName: string) => {
  if (!patientName.trim()) {
    return sessions;
  }

  const searchTerm = patientName.toLowerCase().trim();

  return sessions.filter((session) => {
    if (!session.patient_details?.username) return false;
    return session.patient_details?.username.toLowerCase().includes(searchTerm);
  });
};

const debouncedSearch = debounce(searchByName, 300);

export type TSearchSessionsByPatientRequest = {
  sessions: TSessionHistoryData[];
  patientName: string;
};

const searchSessionsByPatient = async ({
  sessions,
  patientName,
}: TSearchSessionsByPatientRequest) => {
  return debouncedSearch(sessions, patientName);
};

export default searchSessionsByPatient;
