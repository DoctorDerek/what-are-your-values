import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const mergeClassNames = (...inputs: ClassValue[]) =>
  twMerge(clsx(inputs))

export { mergeClassNames as cn }
