import { useEffect } from 'react'

/**
 * Gives focus back to the button that was focused when `active` became true, when it stops being active or the component
 * goes away, as long as that button is still on the page. A dialog that is taken out of the page while it is open (not
 * closed with close()) does not return focus by itself, and focus would fall to the top of the page. Call it BEFORE the
 * effect that opens the dialog, so the button is noted before focus moves into the dialog.
 */
export function useReturnFocus(active = true): void {
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    return () => {
      if (opener && opener.isConnected) opener.focus()
    }
  }, [active])
}
