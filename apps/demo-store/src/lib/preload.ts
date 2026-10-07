// The parts most shoppers never open — the control panel and the 'how it works' page — load on first use. A panel
// link warms its code on hover, focus or touch, so it still opens at once.
import { lazy } from '../ui/lazy';

export const AdminPage = lazy(() => import('../admin/Admin'));
export const HowPage = lazy(() => import('../store/How'));
export const warmProps = { onPointerEnter: AdminPage.preload, onFocus: AdminPage.preload, onTouchStart: AdminPage.preload };
