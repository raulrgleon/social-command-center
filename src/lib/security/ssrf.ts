import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function ipv4Blocked(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) return ipv4Blocked(normalized.slice(7));
  if (isIP(normalized) === 4) return ipv4Blocked(normalized);
  if (isIP(normalized) === 6) return false;
  return true;
}

export async function assertPublicHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("La URL no es válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Solo se admiten direcciones http o https.");
  }
  if (url.username || url.password) throw new Error("La URL no puede incluir credenciales.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Esa dirección no está permitida.");
  }
  if (isIP(host) && isBlockedAddress(host)) throw new Error("Esa dirección no está permitida.");
  const records = await lookup(host, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
    throw new Error("Esa dirección no está permitida.");
  }
  return url;
}
