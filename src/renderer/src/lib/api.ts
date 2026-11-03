export const api = window.api

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}
