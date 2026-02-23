/**
 * COMMON UTILITY FUNCTIONS
 * 
 * Centralized utilities for common operations throughout the app
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from './dayjs';

/**
 * Tailwind CSS class merger
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

// ==========================================
// STRING UTILITIES
// ==========================================

/**
 * Format Indonesian Rupiah currency
 */
export function formatCurrency(amount: number, options?: {
 showCurrency?: boolean;
 decimals?: number;
}): string {
 const { showCurrency = true, decimals = 0 } = options || {};
 
 const formatted = new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: decimals,
 maximumFractionDigits: decimals,
 }).format(amount);

 if (!showCurrency) {
 return formatted.replace('Rp', '').trim();
 }

 return formatted;
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number, decimals = 0): string {
 return new Intl.NumberFormat('id-ID', {
 minimumFractionDigits: decimals,
 maximumFractionDigits: decimals,
 }).format(num);
}

/**
 * Format Indonesian phone number
 */
export function formatPhone(phone: string): string {
 // Remove all non-digits
 const cleaned = phone.replace(/\D/g, '');
 
 // Convert to +62 format
 if (cleaned.startsWith('0')) {
 return '+62' + cleaned.slice(1);
 }
 
 if (cleaned.startsWith('62')) {
 return '+' + cleaned;
 }
 
 return '+62' + cleaned;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
 if (str.length <= length) return str;
 return str.slice(0, length) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
 return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
 return str
 .toLowerCase()
 .split(' ')
 .map(word => capitalize(word))
 .join(' ');
}

/**
 * Slugify string (for URLs)
 */
export function slugify(str: string): string {
 return str
 .toLowerCase()
 .trim()
 .replace(/[^\w\s-]/g, '')
 .replace(/[\s_-]+/g, '-')
 .replace(/^-+|-+$/g, '');
}

/**
 * Generate initials from name
 */
export function getInitials(name: string, maxLength = 2): string {
 const parts = name.trim().split(/\s+/);
 
 if (parts.length === 1) {
 return parts[0]!.slice(0, maxLength).toUpperCase();
 }
 
 return parts
 .map(part => part[0])
 .join('')
 .slice(0, maxLength)
 .toUpperCase();
}

// ==========================================
// NUMBER UTILITIES
// ==========================================

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
 return Math.min(Math.max(num, min), max);
}

/**
 * Round to decimal places
 */
export function round(num: number, decimals = 2): number {
 const factor = Math.pow(10, decimals);
 return Math.round(num * factor) / factor;
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number, decimals = 0): number {
 if (total === 0) return 0;
 return round((value / total) * 100, decimals);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
 if (bytes === 0) return '0 Bytes';
 
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 
 return round(bytes / Math.pow(k, i), 2) + ' ' + sizes[i];
}

// ==========================================
// DATE UTILITIES
// ==========================================

export { dayjs };

/**
 * Format date for display
 */
export function formatDate(date: string | Date, format = 'DD MMMM YYYY'): string {
 return dayjs(date).format(format);
}

/**
 * Get relative time ("2 jam yang lalu")
 */
export function timeAgo(date: string | Date): string {
 return dayjs(date).fromNow();
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
 return dayjs(date).isSame(dayjs(), 'day');
}

// ==========================================
// ARRAY UTILITIES
// ==========================================

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
 return [...new Set(array)];
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
 return array.reduce((result, item) => {
 const groupKey = String(item[key]);
 if (!result[groupKey]) {
 result[groupKey] = [];
 }
 result[groupKey].push(item);
 return result;
 }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
 return [...array].sort((a, b) => {
 const aVal = a[key];
 const bVal = b[key];
 
 if (aVal < bVal) return order === 'asc' ? -1 : 1;
 if (aVal > bVal) return order === 'asc' ? 1 : -1;
 return 0;
 });
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
 const chunks: T[][] = [];
 for (let i = 0; i < array.length; i += size) {
 chunks.push(array.slice(i, i + size));
 }
 return chunks;
}

// ==========================================
// OBJECT UTILITIES
// ==========================================

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
 obj: T,
 keys: K[]
): Pick<T, K> {
 const result = {} as Pick<T, K>;
 keys.forEach(key => {
 if (key in obj) {
 result[key] = obj[key];
 }
 });
 return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
 obj: T,
 keys: K[]
): Omit<T, K> {
 const result = { ...obj };
 keys.forEach(key => {
 delete result[key];
 });
 return result;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: object): boolean {
 return Object.keys(obj).length === 0;
}

// ==========================================
// ASYNC UTILITIES
// ==========================================

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
 return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
 func: T,
 wait: number
): (...args: Parameters<T>) => void {
 let timeout: ReturnType<typeof setTimeout>;
 
 return function executedFunction(...args: Parameters<T>) {
 const later = () => {
 clearTimeout(timeout);
 func(...args);
 };
 
 clearTimeout(timeout);
 timeout = setTimeout(later, wait);
 };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
 func: T,
 limit: number
): (...args: Parameters<T>) => void {
 let inThrottle: boolean;
 
 return function executedFunction(...args: Parameters<T>) {
 if (!inThrottle) {
 func(...args);
 inThrottle = true;
 setTimeout(() => (inThrottle = false), limit);
 }
 };
}

/**
 * Retry async function
 */
export async function retry<T>(
 fn: () => Promise<T>,
 options: {
 retries?: number;
 delay?: number;
 onRetry?: (error: Error, attempt: number) => void;
 } = {}
): Promise<T> {
 const { retries = 3, delay = 1000, onRetry } = options;
 
 for (let attempt = 1; attempt <= retries; attempt++) {
 try {
 return await fn();
 } catch (error) {
 if (attempt === retries) throw error;
 
 onRetry?.(error as Error, attempt);
 await sleep(delay * attempt); // Exponential backoff
 }
 }
 
 throw new Error('Retry failed');
}

// ==========================================
// URL UTILITIES
// ==========================================

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, any>): string {
 const searchParams = new URLSearchParams();
 
 Object.entries(params).forEach(([key, value]) => {
 if (value !== null && value !== undefined && value !== '') {
 searchParams.append(key, String(value));
 }
 });
 
 const queryString = searchParams.toString();
 return queryString ? `?${queryString}` : '';
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
 const params = new URLSearchParams(queryString);
 const result: Record<string, string> = {};
 
 params.forEach((value, key) => {
 result[key] = value;
 });
 
 return result;
}

// ==========================================
// VALIDATION UTILITIES
// ==========================================

/**
 * Check if valid email
 */
export function isValidEmail(email: string): boolean {
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 return emailRegex.test(email);
}

/**
 * Check if valid Indonesian phone
 */
export function isValidPhone(phone: string): boolean {
 const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
 return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Check if valid URL
 */
export function isValidUrl(url: string): boolean {
 try {
 new URL(url);
 return true;
 } catch {
 return false;
 }
}

// ==========================================
// RANDOM UTILITIES
// ==========================================

/**
 * Generate random string
 */
export function randomString(length = 10): string {
 const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 let result = '';
 for (let i = 0; i < length; i++) {
 result += chars.charAt(Math.floor(Math.random() * chars.length));
 }
 return result;
}

/**
 * Generate UUID v4
 */
export function uuid(): string {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
 const r = (Math.random() * 16) | 0;
 const v = c === 'x' ? r : (r & 0x3) | 0x8;
 return v.toString(16);
 });
}

// ==========================================
// COPY TO CLIPBOARD
// ==========================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
 try {
 await navigator.clipboard.writeText(text);
 return true;
 } catch (error) {
 // Fallback for older browsers
 const textArea = document.createElement('textarea');
 textArea.value = text;
 textArea.style.position = 'fixed';
 textArea.style.left = '-999999px';
 document.body.appendChild(textArea);
 textArea.select();
 
 try {
 document.execCommand('copy');
 document.body.removeChild(textArea);
 return true;
 } catch {
 document.body.removeChild(textArea);
 return false;
 }
 }
}

// ==========================================
// LOCAL STORAGE UTILITIES
// ==========================================

/**
 * Safe local storage get
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
 try {
 const item = window.localStorage.getItem(key);
 return item ? JSON.parse(item) : defaultValue;
 } catch {
 return defaultValue;
 }
}

/**
 * Safe local storage set
 */
export function setLocalStorage<T>(key: string, value: T): boolean {
 try {
 window.localStorage.setItem(key, JSON.stringify(value));
 return true;
 } catch {
 return false;
 }
}

/**
 * Remove from local storage
 */
export function removeLocalStorage(key: string): void {
 try {
 window.localStorage.removeItem(key);
 } catch {
 // Ignore errors
 }
}
