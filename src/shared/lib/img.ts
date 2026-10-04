/** Imagen local de /public/img (por clave) o URL remota tal cual (resultados reales del backend). */
export const imgSrc = (k: string) => (/^https?:\/\//.test(k) ? k : `/img/${k}.jpg`);
