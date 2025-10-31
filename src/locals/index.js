import { helpMessageHTML as enHelp } from './en';
import { helpMessageHTML as zhHelp } from './zh';
import { helpMessageHTML as hiHelp } from './hi';
import { helpMessageHTML as esHelp } from './es';
import { helpMessageHTML as frHelp } from './fr';
import { helpMessageHTML as arHelp } from './ar';
import { helpMessageHTML as bnHelp } from './bn';
import { helpMessageHTML as ptHelp } from './pt';
import { helpMessageHTML as ruHelp } from './ru';

/**
 * A dictionary mapping language codes (like 'en', 'es')
 * to their corresponding pre-translated HTML string.
 */
export const helpMessages = {
  en: enHelp, // English
  zh: zhHelp, // Chinese
  hi: hiHelp, // Hindi
  es: esHelp, // Spanish
  fr: frHelp, // French
  ar: arHelp, // Arabic
  bn: bnHelp, // Bengali
  pt: ptHelp, // Portuguese
  ru: ruHelp, // Russian
};