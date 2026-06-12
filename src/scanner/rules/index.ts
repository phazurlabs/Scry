/**
 * The complete v1 rule set, in id order. Adding a rule means importing it here
 * and bumping CRITERIA_VERSION in report/schema.ts — nothing else discovers
 * rules implicitly, so the active rule set is always exactly this list.
 */
import type { Rule } from '../types.js';
import scry001 from './scry001.js';
import scry002 from './scry002.js';
import scry003 from './scry003.js';
import scry004 from './scry004.js';
import scry005 from './scry005.js';
import scry006 from './scry006.js';
import scry007 from './scry007.js';
import scry008 from './scry008.js';
import scry009 from './scry009.js';
import scry010 from './scry010.js';

export const RULES: Rule[] = [
  scry001,
  scry002,
  scry003,
  scry004,
  scry005,
  scry006,
  scry007,
  scry008,
  scry009,
  scry010,
];
