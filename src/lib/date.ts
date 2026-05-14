import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getConfig } from './config';

export function getCurrentTimezonedDate(): string {
  let timezone = 'Europe/Vienna';
  try {
    const config = getConfig();
    if (config.timezone) {
      timezone = config.timezone;
    }
  } catch (e) {
    // Fallback if config is not available yet (e.g. during early setup)
  }
  
  // Format as ISO 8601 with timezone offset (e.g. 2026-05-14T23:41:00+02:00)
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
