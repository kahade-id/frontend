/**
 * DAY.JS UTILITY - MOMENT.JS REPLACEMENT
 * 
 * PERFORMANCE FIX [FE-PERF-002]: Replace Moment.js with Day.js
 * 
 * Bundle size savings:
 * - Moment.js: ~67KB gzipped
 * - Day.js: ~2KB gzipped
 * - Savings: ~65KB (97% reduction!)
 * 
 * Day.js provides almost identical API to Moment.js,
 * making migration straightforward.
 */

import dayjs from 'dayjs';

// Plugins
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import calendar from 'dayjs/plugin/calendar';

// Locales
import 'dayjs/locale/id'; // Indonesian
import 'dayjs/locale/en'; // English

// Extend dayjs with plugins
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(calendar);

// Set default locale to Indonesian
dayjs.locale('id');

// Set default timezone to WIB (Asia/Jakarta)
dayjs.tz.setDefault('Asia/Jakarta');

/**
 * Common date format constants
 */
export const DATE_FORMATS = {
 // Display formats
 DISPLAY_DATE: 'DD MMMM YYYY', // "14 Februari 2026"
 DISPLAY_DATE_SHORT: 'DD MMM YYYY', // "14 Feb 2026"
 DISPLAY_TIME: 'HH:mm', // "12:56"
 DISPLAY_TIME_FULL: 'HH:mm:ss', // "12:56:30"
 DISPLAY_DATETIME: 'DD MMMM YYYY HH:mm', // "14 Februari 2026 12:56"
 DISPLAY_DATETIME_FULL: 'DD MMMM YYYY HH:mm:ss', // "14 Februari 2026 12:56:30"
 
 // API formats
 API_DATE: 'YYYY-MM-DD', // "2026-02-14"
 API_DATETIME: 'YYYY-MM-DD HH:mm:ss', // "2026-02-14 12:56:30"
 API_DATETIME_ISO: 'YYYY-MM-DDTHH:mm:ss', // "2026-02-14T12:56:30"
 
 // Input formats
 INPUT_DATE: 'DD/MM/YYYY', // "14/02/2026"
 INPUT_TIME: 'HH:mm', // "12:56"
} as const;

/**
 * Utility functions for common date operations
 */
export const dateUtils = {
 /**
 * Format date for display in Indonesian
 */
 formatDisplay: (date: string | Date | dayjs.Dayjs, includeTime = false): string => {
 const d = dayjs(date);
 return includeTime 
 ? d.format(DATE_FORMATS.DISPLAY_DATETIME)
 : d.format(DATE_FORMATS.DISPLAY_DATE);
 },

 /**
 * Format date for API submission
 */
 formatForAPI: (date: string | Date | dayjs.Dayjs): string => {
 return dayjs(date).format(DATE_FORMATS.API_DATE);
 },

 /**
 * Get relative time ("2 jam yang lalu")
 */
 fromNow: (date: string | Date | dayjs.Dayjs): string => {
 return dayjs(date).fromNow();
 },

 /**
 * Get relative time to another date
 */
 from: (date: string | Date | dayjs.Dayjs, compareDate: string | Date | dayjs.Dayjs): string => {
 return dayjs(date).from(dayjs(compareDate));
 },

 /**
 * Check if date is today
 */
 isToday: (date: string | Date | dayjs.Dayjs): boolean => {
 return dayjs(date).isSame(dayjs(), 'day');
 },

 /**
 * Check if date is in the past
 */
 isPast: (date: string | Date | dayjs.Dayjs): boolean => {
 return dayjs(date).isBefore(dayjs());
 },

 /**
 * Check if date is in the future
 */
 isFuture: (date: string | Date | dayjs.Dayjs): boolean => {
 return dayjs(date).isAfter(dayjs());
 },

 /**
 * Get difference between dates
 */
 diff: (date1: string | Date | dayjs.Dayjs, date2: string | Date | dayjs.Dayjs, unit: dayjs.UnitType = 'day'): number => {
 return dayjs(date1).diff(dayjs(date2), unit);
 },

 /**
 * Get start of period
 */
 startOf: (date: string | Date | dayjs.Dayjs, unit: dayjs.OpUnitType): dayjs.Dayjs => {
 return dayjs(date).startOf(unit);
 },

 /**
 * Get end of period
 */
 endOf: (date: string | Date | dayjs.Dayjs, unit: dayjs.OpUnitType): dayjs.Dayjs => {
 return dayjs(date).endOf(unit);
 },

 /**
 * Add time to date
 */
 add: (date: string | Date | dayjs.Dayjs, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs => {
 return dayjs(date).add(value, unit);
 },

 /**
 * Subtract time from date
 */
 subtract: (date: string | Date | dayjs.Dayjs, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs => {
 return dayjs(date).subtract(value, unit);
 },

 /**
 * Check if date is between two dates
 */
 isBetween: (date: string | Date | dayjs.Dayjs, start: string | Date | dayjs.Dayjs, end: string | Date | dayjs.Dayjs): boolean => {
 return dayjs(date).isBetween(start, end);
 },

 /**
 * Parse date from string with custom format
 */
 parse: (dateString: string, format: string): dayjs.Dayjs => {
 return dayjs(dateString, format);
 },

 /**
 * Get current date/time
 */
 now: (): dayjs.Dayjs => {
 return dayjs();
 },

 /**
 * Get calendar time ("Kemarin", "Hari ini", "Besok")
 */
 calendar: (date: string | Date | dayjs.Dayjs): string => {
 return dayjs(date).calendar(null, {
 sameDay: '[Hari ini pukul] HH:mm',
 nextDay: '[Besok pukul] HH:mm',
 nextWeek: 'dddd [pukul] HH:mm',
 lastDay: '[Kemarin pukul] HH:mm',
 lastWeek: 'dddd [lalu pukul] HH:mm',
 sameElse: 'DD/MM/YYYY HH:mm'
 });
 },

 /**
 * Format duration (e.g., "2 jam 30 menit")
 */
 formatDuration: (milliseconds: number): string => {
 const dur = dayjs.duration(milliseconds);
 const hours = Math.floor(dur.asHours());
 const minutes = dur.minutes();
 const seconds = dur.seconds();

 const parts: string[] = [];
 if (hours > 0) parts.push(`${hours} jam`);
 if (minutes > 0) parts.push(`${minutes} menit`);
 if (seconds > 0 && hours === 0) parts.push(`${seconds} detik`);

 return parts.join(' ') || '0 detik';
 },

 /**
 * Get time ago in short format ("2j", "5m", "30d")
 */
 shortTimeAgo: (date: string | Date | dayjs.Dayjs): string => {
 const now = dayjs();
 const then = dayjs(date);
 
 const seconds = now.diff(then, 'second');
 const minutes = now.diff(then, 'minute');
 const hours = now.diff(then, 'hour');
 const days = now.diff(then, 'day');
 const months = now.diff(then, 'month');
 const years = now.diff(then, 'year');

 if (seconds < 60) return `${seconds}d`;
 if (minutes < 60) return `${minutes}m`;
 if (hours < 24) return `${hours}j`;
 if (days < 30) return `${days}h`;
 if (months < 12) return `${months}b`;
 return `${years}t`;
 },
};

/**
 * Transaction-specific date utilities
 */
export const transactionDateUtils = {
 /**
 * Check if transaction is expired
 */
 isExpired: (expiryDate: string | Date): boolean => {
 return dayjs(expiryDate).isBefore(dayjs());
 },

 /**
 * Get remaining time until expiry
 */
 getRemainingTime: (expiryDate: string | Date): string => {
 const now = dayjs();
 const expiry = dayjs(expiryDate);
 
 if (expiry.isBefore(now)) {
 return 'Kadaluarsa';
 }
 
 const hours = expiry.diff(now, 'hour');
 const minutes = expiry.diff(now, 'minute') % 60;
 
 if (hours > 24) {
 const days = Math.floor(hours / 24);
 return `${days} hari lagi`;
 }
 
 if (hours > 0) {
 return `${hours} jam ${minutes} menit lagi`;
 }
 
 return `${minutes} menit lagi`;
 },

 /**
 * Format transaction date
 */
 formatTransactionDate: (date: string | Date): string => {
 const d = dayjs(date);
 const now = dayjs();
 
 // If today, show "Hari ini, HH:mm"
 if (d.isSame(now, 'day')) {
 return `Hari ini, ${d.format('HH:mm')}`;
 }
 
 // If yesterday, show "Kemarin, HH:mm"
 if (d.isSame(now.subtract(1, 'day'), 'day')) {
 return `Kemarin, ${d.format('HH:mm')}`;
 }
 
 // If this year, show "DD MMM, HH:mm"
 if (d.isSame(now, 'year')) {
 return d.format('DD MMM, HH:mm');
 }
 
 // Otherwise, show full date
 return d.format('DD MMM YYYY, HH:mm');
 },
};

// Export configured dayjs as default
export default dayjs;

/**
 * MIGRATION GUIDE FROM MOMENT.JS
 * 
 * Replace:
 * import moment from 'moment';
 * 
 * With:
 * import dayjs from '@kahade/utils';
 * 
 * API is 99% compatible:
 * moment() → dayjs()
 * moment(date) → dayjs(date)
 * moment().format('...') → dayjs().format('...')
 * moment().fromNow() → dayjs().fromNow()
 * moment().add(7, 'days') → dayjs().add(7, 'day')
 * 
 * Or use utilities:
 * import { dateUtils } from '@kahade/utils';
 * dateUtils.formatDisplay(date);
 * dateUtils.fromNow(date);
 */
