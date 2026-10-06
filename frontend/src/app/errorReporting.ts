/**
 * Where errors that nobody handled go. Nothing is sent anywhere by default: the app has no error-reporting service yet.
 * When one is chosen, give it to `setErrorReporter` once at start-up; every caller then reaches it through `reportError`.
 *
 * What may be reported: the error's name, its message and its stack, and a short `where` label. What must not: anything
 * a person typed, the sign-in token, e-mail addresses or the text of research. Callers pass the error object only, and
 * the reporter should drop the address's query string (it can hold a recovery token).
 */
export type ErrorReporter = (error: unknown, where: string) => void

let reporter: ErrorReporter | null = null

export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next
}

export function reportError(error: unknown, where: string): void {
  try {
    if (reporter) reporter(error, where)
    else if (import.meta.env.DEV) console.error(`[${where}]`, error)
  } catch {
    /* reporting must never cause another error */
  }
}

/** Errors outside React's render (a failed script, a promise nobody awaited). Call once at start-up. */
export function listenForUnhandledErrors(target: Pick<Window, 'addEventListener'> = window): void {
  target.addEventListener('error', (e) => reportError((e as ErrorEvent).error ?? (e as ErrorEvent).message, 'window'))
  target.addEventListener('unhandledrejection', (e) => reportError((e as PromiseRejectionEvent).reason, 'promise'))
}
