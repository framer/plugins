/**
 * Logging utilities for consistent output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLevel = LogLevel.INFO

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export function debug(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.DEBUG) {
    console.debug(`[DEBUG] ${message}`, ...args)
  }
}

export function info(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.INFO) {
    console.info(`[INFO] ${message}`, ...args)
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.WARN) {
    console.warn(`[WARN] ${message}`, ...args)
  }
}

export function error(message: string, ...args: unknown[]): void {
  if (currentLevel <= LogLevel.ERROR) {
    console.error(`[ERROR] ${message}`, ...args)
  }
}

