// «iPhone · Safari», «Android · Chrome», «Windows · Edge»: lectura simple y legible del aparato desde el User-Agent.
export function deviceLabel(ua: string | null | undefined) {
  if (!ua) return "aparato no disponible";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro sistema";
  const browser = /EdgA?\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /(Chrome|CriOS)\//.test(ua) ? "Chrome" : /(Firefox|FxiOS)\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navegador desconocido";
  return `${os} · ${browser}`;
}
