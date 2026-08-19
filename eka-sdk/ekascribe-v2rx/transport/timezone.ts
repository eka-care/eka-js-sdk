// Returns the current IANA timezone name (e.g. 'Asia/Kolkata'), falling back to 'UTC'
export function getCurrentTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return undefined;
  }
}
