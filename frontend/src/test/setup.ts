import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { session } from '@/api/http'
import { initI18n } from '@/i18n'
import { server } from './server'

// jsdom does not implement <dialog> modal methods.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

initI18n('en')

// Pages are loaded when their route opens, so the first look for something on a page can wait for its code to be fetched.
configure({ asyncUtilTimeout: 5000 })

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  session.set(null)
  localStorage.clear()
})
afterAll(() => server.close())
