/* Portada de la ruta en /crear: las piezas de smarty-poc app/src/lib/routeCover.ts que usa el creador, TAL CUAL.
   - mqThumb: miniatura 16:9 del video (vista previa cuando el 1er contenido es un video y no hay portada manual).
   - cropToCover: recorte de la imagen subida al estándar de la card (16:9, center-crop / cover-fit) comprimida a data URL
     JPEG 0.82 de 640×360, sin backend. La portada viaja en route.cover. (La resolución completa de portadas del mosaico
     —maxres del video, imagen del artículo de Wikipedia— es de Learn, no del creador.) */

/** Miniatura 16:9 SIEMPRE disponible (320×180, sin barras). */
export function mqThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(src); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('no se pudo leer la imagen')); };
    img.src = src;
  });
}

/** Recorta+escala una imagen a la relación de la card (16:9) con center-crop (cover-fit) y la comprime a data URL JPEG. */
export async function cropToCover(file: File, w = 640, h = 360): Promise<string> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas no disponible');
  const scale = Math.max(w / img.width, h / img.height); // llena la card, recorta el excedente
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return canvas.toDataURL('image/jpeg', 0.82);
}
