import { TSessionHistoryData } from '../constants/types';

// Generic debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(func(...args));
      }, delay);
    });
  };
}

// Search criteria type
export type TSearchCriteria = {
  patientName?: string;
  sessionId?: string;
};

// Enhanced request type supporting multiple search criteria
export type TSearchSessionsRequest = {
  sessions: TSessionHistoryData[];
  searchCriteria: TSearchCriteria;
};

export type TSearchSessionsByPatientRequest = {
  sessions: TSessionHistoryData[];
  patientName?: string;
  sessionId?: string;
};

// Modular search functions
const searchByPatientName = (
  sessions: TSessionHistoryData[],
  patientName: string
): TSessionHistoryData[] => {
  if (!patientName.trim()) {
    return sessions;
  }

  const searchTerm = patientName.toLowerCase().trim();

  return sessions.filter((session) => {
    if (!session.patient_details?.username) return false;
    return session.patient_details.username.toLowerCase().includes(searchTerm);
  });
};

const searchBySessionId = (
  sessions: TSessionHistoryData[],
  sessionId: string
): TSessionHistoryData[] => {
  if (!sessionId.trim()) {
    return sessions;
  }

  const searchTerm = sessionId.toLowerCase().trim();

  return sessions.filter((session) => {
    return session.txn_id.toLowerCase().includes(searchTerm);
  });
};

// Combined search function that applies multiple criteria
const performSearch = (
  sessions: TSessionHistoryData[],
  searchCriteria: TSearchCriteria
): TSessionHistoryData[] => {
  let filteredSessions = sessions;

  // Apply patient name filter if provided
  if (searchCriteria.patientName) {
    filteredSessions = searchByPatientName(filteredSessions, searchCriteria.patientName);
  }

  // Apply session ID filter if provided
  if (searchCriteria.sessionId) {
    filteredSessions = searchBySessionId(filteredSessions, searchCriteria.sessionId);
  }

  // If no search criteria provided, return all sessions
  if (!searchCriteria.patientName && !searchCriteria.sessionId) {
    return sessions;
  }

  return filteredSessions;
};

// Debounced search function
const debouncedSearch = debounce(performSearch, 300);

// Main search function
const searchSessions = async ({
  sessions,
  searchCriteria,
}: TSearchSessionsRequest): Promise<TSessionHistoryData[]> => {
  return debouncedSearch(sessions, searchCriteria);
};

const searchSessionsByPatient = async ({
  sessions,
  patientName,
}: TSearchSessionsByPatientRequest): Promise<TSessionHistoryData[]> => {
  return searchSessions({
    sessions,
    searchCriteria: { patientName },
  });
};

const searchSessionsBySessionId = async ({
  sessions,
  sessionId,
}: TSearchSessionsByPatientRequest): Promise<TSessionHistoryData[]> => {
  return searchSessions({
    sessions,
    searchCriteria: { sessionId },
  });
};

export default searchSessions;

export { searchSessionsByPatient, searchSessionsBySessionId };
