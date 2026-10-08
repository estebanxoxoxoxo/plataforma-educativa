// Portón de adulto de la Zona de padres. v1: "mantené apretado 3 segundos" (frena al chico curioso,
// no a un adolescente decidido). Pasarlo vale por la SESIÓN DE PÁGINA: es estado en memoria, así que
// una carga nueva —que además resetea la demo— lo vuelve a pedir. "Cerrar zona de padres" lo cierra.
// TODO(PIN parental): acá va el PIN parental real, validado por el SERVER (Smarty ya tiene uno de 6
// dígitos). NUNCA guardar, loguear ni persistir el PIN en el cliente (docs/AGENTS.md, Seguridad).
import { useSyncExternalStore } from 'react';

/** Cuánto hay que mantener apretado para entrar. */
export const HOLD_MS = 3000;

let unlocked = false;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const get = () => unlocked;
const set = (v: boolean) => { if (unlocked === v) return; unlocked = v; listeners.forEach((l) => l()); };

export const useAdultUnlocked = () => useSyncExternalStore(subscribe, get, get);
export const unlockAdult = () => set(true);
export const lockAdult = () => set(false);
