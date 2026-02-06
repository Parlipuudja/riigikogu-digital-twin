import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, locale: string = "et"): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "et" ? "et-EE" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}
