// Formas del panel: ya formalizadas en el contrato (src/api/types.ts); acá solo se re-exportan.
export type { ParentItemView, ParentProtections, ParentItemPatch } from '../../../api/types';
import type { ParentActivity, ParentFeatures, ParentPreset, ParentTopics, ParentVolume } from '../../../api/types';
/** GET /api/parent/activity tal como lo sirve el server. */
export type ParentDashboard = ParentActivity;

/** Lo que deja configurado un preset: ADITIVO del server (GET /api/parent/presets, campo `spec`; pendiente de
 *  formalizar en types.ts). Con él la tarjeta muestra qué prende y qué apaga sin duplicar la definición acá. */
export type PresetSpec = { features: ParentFeatures; topics: ParentTopics; words: string[]; volume: ParentVolume };
export type PresetView = ParentPreset & { spec?: PresetSpec };
