export type GiaTriSearchParam = string | string[] | undefined;

export function motGiaTri(v: GiaTriSearchParam): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

