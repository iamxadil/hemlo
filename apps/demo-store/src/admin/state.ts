// Panel-wide state the pages share.
import { signal } from '@preact/signals';

/** Which store page the live preview shows: the product being edited, or the home page. */
export const previewAt = signal('/');
