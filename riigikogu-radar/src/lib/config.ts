/**
 * Environment configuration and validation
 * Validates required environment variables at startup
 */

export interface EnvConfig {
  /** MongoDB connection string */
  MONGODB_URI: string;
  /** Anthropic API key for Claude */
  ANTHROPIC_API_KEY: string;
  /** Voyage AI API key for embeddings */
  VOYAGE_API_KEY: string;
  /** Node environment */
  NODE_ENV: "development" | "production" | "test";
  /** Is production environment */
  isProduction: boolean;
  /** Is development environment */
  isDevelopment: boolean;
}

/**
 * Required environment variables
 * Missing any of these will throw an error
 */
const REQUIRED_VARS = [
  "MONGODB_URI",
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_VARS = {
  NODE_ENV: "development",
} as const;

let cachedConfig: EnvConfig | null = null;

/**
 * Validate and return environment configuration
 * Caches result after first call
 *
 * @throws Error if required environment variables are missing
 */
export function getEnvConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const missing: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName]?.trim();
    if (!value) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env file or environment configuration."
    );
  }

  const nodeEnv = (process.env.NODE_ENV || OPTIONAL_VARS.NODE_ENV) as EnvConfig["NODE_ENV"];

  cachedConfig = {
    MONGODB_URI: process.env.MONGODB_URI!.trim(),
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!.trim(),
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY!.trim(),
    NODE_ENV: nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
  };

  return cachedConfig;
}

/**
 * Validate environment on import (for early detection)
 * Only runs validation in production to avoid issues during build
 */
export function validateEnvOnStartup(): void {
  // Skip validation during build time
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  try {
    getEnvConfig();
  } catch (error) {
    // Log warning but don't crash during development
    if (process.env.NODE_ENV === "development") {
      console.warn("[Config Warning]", (error as Error).message);
    } else {
      throw error;
    }
  }
}

/**
 * Get a specific environment variable with optional default
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key]?.trim() || defaultValue;
}

/**
 * Get a required environment variable
 *
 * @param key - Environment variable name
 * @throws Error if variable is not set
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}
