/* Color por módulo (estilo Duolingo: cada módulo tiñe su banda Y sus nodos). Cicla por posición.
   band = banda del header (tinte suave), ink = texto, soft = halo del nodo disponible,
   strong = nodo logrado/recall. Los bloqueados quedan grises (señal universal). */
/* PORTE INNERITH (W3): los 6 pares EXACTOS de smarty-poc app/src/zones/child/RutaView.tsx. */
export type ModuleColor = { band: string; ink: string; soft: string; strong: string };
export const MODULE_COLORS: ModuleColor[] = [
  { band: '#e6f1fb', ink: '#0c447c', soft: '#b5d4f4', strong: '#378add' }, // azul
  { band: '#e1f5ee', ink: '#085041', soft: '#9fe1cb', strong: '#1d9e75' }, // teal
  { band: '#faece7', ink: '#712b13', soft: '#f5c4b3', strong: '#d85a30' }, // coral
  { band: '#fbeaf0', ink: '#72243e', soft: '#f4c0d1', strong: '#d4537e' }, // rosa
  { band: '#eaf3de', ink: '#27500a', soft: '#c0dd97', strong: '#639922' }, // verde
  { band: '#faeeda', ink: '#633806', soft: '#fac775', strong: '#ba7517' }, // ámbar
];
