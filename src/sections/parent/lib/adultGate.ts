// Pedidos de Familia (la ex Zona de padres). Desde el 14-oct (docs/USUARIOS.md §5) Familia es el punto de menú del ADULTO,
// SIN portón de PIN: la sesión es la del usuario activo (el server la da por buena si es un adulto: X-Innerith-User,
// server/src/users.ts + hasParentSession de parent.ts). Se retiraron el portón del cliente (AdultGate), el token
// (X-Parent-Token) y el "Cerrar zona de padres"; el PIN del server quedó dormido para la versión futura.
// Queda el punto único por donde pasa todo pedido de los paneles, para cuando vuelva una sesión de verdad.

/** Todo pedido de los paneles de Familia pasa por acá. Sin portón no hay nada que cerrar: un error —también un 401, p. ej.
 *  si el usuario activo es un chico— se relanza tal cual y lo muestra el panel. */
export function parentCall<T>(p: Promise<T>): Promise<T> {
  return p;
}
