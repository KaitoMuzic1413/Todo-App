import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export const TASK_TITLE_MAX_LENGTH = 200;

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
