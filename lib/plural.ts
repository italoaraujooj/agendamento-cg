/** Número + palavra no singular ou plural: plural(1, "evento", "eventos") → "1 evento" */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
