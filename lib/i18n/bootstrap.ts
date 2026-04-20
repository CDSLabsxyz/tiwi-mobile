/**
 * Side-effect module: installs the global Text auto-translate patch and
 * warms up the auto-translate cache. Import at the very top of the root
 * layout (after polyfills) so the patch runs before any screen imports
 * `<Text>`.
 */

import { preloadAutoTranslateCache } from './autoTranslate';
import { installGlobalTranslate } from './installGlobalTranslate';

installGlobalTranslate();
preloadAutoTranslateCache();
