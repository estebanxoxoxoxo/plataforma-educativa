// Formas del panel: ya formalizadas en el contrato (src/api/types.ts); acá solo se re-exportan.
export type { ParentItemView, ParentProtections, ParentItemPatch } from '../../../api/types';
import type { ParentActivity } from '../../../api/types';
/** GET /api/parent/activity tal como lo sirve el server. */
export type ParentDashboard = ParentActivity;
