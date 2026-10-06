export function tabPanelId(firstTab: string) {
  return (
    "panel-" +
    firstTab
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
  )
}

export function tabButtonId(firstTab: string, tab: string) {
  return tabPanelId(firstTab) + "-" + tabPanelId(tab)
}
