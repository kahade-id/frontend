import { z } from 'zod';

/**
 * Environment Variable Validation Schema
 * FIX (Issue #9): Removed VITE_AUTH_TOKEN_KEY and VITE_AUTH_REFRESH_TOKEN_KEY —
 * these were orphaned after migration to HttpOnly cookie auth and implied
 * localStorage token storage. Keeping them created confusion and risk of
 * re-introducing insecure patterns.
 */
const envSchema = z.object({
  // App Configuration
  VITE_APP_MODE: z.enum(['landing', 'app', 'admin']).default('landing'),
  VITE_APP_NAME: z.string().default('Kahade'),
  VITE_APP_VERSION: z.string().default('1.0.0'),
  VITE_APP_DESCRIPTION: z.string().optional(),

  // API Configuration (Required)
  VITE_API_BASE_URL: z.string().min(1, {
    message: 'VITE_API_BASE_URL must be set',
  }),
  VITE_API_TIMEOUT: z.coerce.number().positive().default(15000),

  // WebSocket Configuration
  VITE_WS_URL: z.string().url().optional(),
  VITE_WS_PATH: z.string().default('/socket.io'),

  // Feature Flags
  VITE_ENABLE_PWA: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  VITE_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  VITE_ENABLE_ERROR_REPORTING: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
  VITE_ENABLE_PERFORMANCE_MONITORING: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),

  // Third Party Services (Optional)
  VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
  VITE_RECAPTCHA_SITE_KEY: z.string().optional(),

  VITE_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  VITE_SENTRY_ENVIRONMENT: z.string().default('development'),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Analytics (Optional)
  VITE_GA_TRACKING_ID: z.string().optional(),
  VITE_ANALYTICS_ENDPOINT: z.string().url().optional(),
  VITE_ANALYTICS_WEBSITE_ID: z.string().optional(),

  // CDN Configuration (Optional)
  VITE_CDN_URL: z.string().url().optional(),
  VITE_ASSET_PREFIX: z.string().default('/'),

  // Build Configuration (Set by CI/CD)
  VITE_BUILD_TIME: z.string().optional(),
  VITE_COMMIT_SHA: z.string().optional(),

  // Security
  VITE_ENABLE_CSP: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('true'),
  VITE_CSP_REPORT_URI: z.string().url().optional(),

  // Localization
  VITE_DEFAULT_LOCALE: z.string().default('id'),
  VITE_SUPPORTED_LOCALES: z.string().default('id,en'),

  // Domain Configuration
  VITE_LANDING_DOMAIN: z.string().optional(),
  VITE_APP_DOMAIN: z.string().optional(),
  VITE_ADMIN_DOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const envData = {
    ...import.meta.env,
  };

  try {
    return envSchema.parse(envData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) => `  - ${err.path.join('.')}: ${err.message}`
      );

      console.error(
        '\n❌ Environment Variable Validation Failed:\n' +
        errors.join('\n') +
        '\n\nPlease check your .env file and ensure all required variables are set correctly.\n'
      );

      if (import.meta.env.PROD) {
        throw new Error('Invalid environment configuration');
      }
    }
    throw error;
  }
}

export const env = parseEnv();

export const isFeatureEnabled = (feature: keyof Pick<Env,
  | 'VITE_ENABLE_PWA'
  | 'VITE_ENABLE_ANALYTICS'
  | 'VITE_ENABLE_ERROR_REPORTING'
  | 'VITE_ENABLE_PERFORMANCE_MONITORING'
  | 'VITE_ENABLE_CSP'
>): boolean => {
  return env[feature] === true;
};

if (import.meta.env.DEV) {
  console.log('[Kahade] Features:', {
    PWA: env.VITE_ENABLE_PWA,
    Analytics: env.VITE_ENABLE_ANALYTICS,
    ErrorReporting: env.VITE_ENABLE_ERROR_REPORTING,
    PerformanceMonitoring: env.VITE_ENABLE_PERFORMANCE_MONITORING,
  });
}
