export function getAssetUrl(path: string) {
    return /^(https?:|data:|blob:|\/)/.test(path) ? path : "/" + path
  }