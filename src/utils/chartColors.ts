export function heatmapCellColors(
  value: number,
  minimum: number,
  maximum: number,
) {
  const amount =
    maximum === minimum ? 0 : (value - minimum) / (maximum - minimum)
  const theme = getComputedStyle(document.documentElement)
  const channelsFor = (token: string) => {
    const hex = theme.getPropertyValue(token).trim().replace("#", "")
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  }
  const light = channelsFor("--heatmap-start")
  const dark = channelsFor("--heatmap-end")
  const channels = light.map((channel, index) =>
    Math.round(channel + (dark[index] - channel) * amount),
  )
  const luminance = channels
    .map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4)
    })
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    )
  return {
    backgroundColor: "rgb(" + channels.join(", ") + ")",
    color:
      1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
        ? "var(--heatmap-light-text)"
        : "var(--heatmap-dark-text)",
  }
}
