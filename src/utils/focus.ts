export function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      !element.closest('[inert], [hidden], [aria-hidden="true"]'),
  )
}

export function restoreFocus(previous: HTMLElement | null) {
  const bounds = previous?.getBoundingClientRect()
  if (
    previous?.isConnected &&
    !previous.closest("[inert]") &&
    bounds &&
    bounds.right > 0 &&
    bounds.left < window.innerWidth &&
    bounds.width > 0
  )
    previous.focus()
  else
    document
      .querySelector<HTMLElement>('button[aria-label="Abrir navegação"]')
      ?.focus()
}

export function trapFocus(
  event: KeyboardEvent,
  container: HTMLElement,
  heading?: HTMLElement | null,
) {
  if (event.key !== "Tab") return
  const nodes = focusableElements(container)
  if (!nodes.length) {
    event.preventDefault()
    heading?.focus()
    return
  }
  if (!container.contains(document.activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? nodes[nodes.length - 1] : nodes[0]).focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === nodes[0] || document.activeElement === heading)
  ) {
    event.preventDefault()
    nodes[nodes.length - 1].focus()
  } else if (
    !event.shiftKey &&
    document.activeElement === nodes[nodes.length - 1]
  ) {
    event.preventDefault()
    nodes[0].focus()
  }
}
