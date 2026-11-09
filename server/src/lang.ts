// i18n (pedido 9-nov): el texto que viaja al usuario en el idioma del pedido. Se resuelve AL SERVIR leyendo el idioma del
// AsyncLocalStorage (requestContext.ts: cabecera X-Smarty-Lang) para no threadear `req` por todo el server; fuera de un pedido, castellano.
import { requestLang } from './requestContext'

export const L = (es: string, en: string): string => (requestLang() === 'en' ? en : es)
