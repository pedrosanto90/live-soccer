// Tipos utilitários partilhados por toda a aplicação.

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
