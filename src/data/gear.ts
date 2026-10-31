import type { Gear } from '../types.ts'

// Gear is matched by its kind, as typed in Gear. Each pattern ignores case.
// Only a kind that ends in the word counts, so parts and upgrades filed as "Grinder burrs" or "Machine parts" stay out.
// "Espresso machine" matches, "Machine parts" doesn't: https://regex101.com/?regex=machines%3F%5Cs*%24&flags=i&testString=Espresso%20machine
export const MACHINE_KIND = /machines?\s*$/i
// "Hand grinder" and "Grinders" match, "Grinder burrs" doesn't: https://regex101.com/?regex=grinders%3F%5Cs*%24&flags=i&testString=Hand%20grinder
export const GRINDER_KIND = /grinders?\s*$/i
// "VST basket" matches, "Dripper" doesn't: https://regex101.com/?regex=basket&flags=i&testString=VST%20basket
export const BASKET_KIND = /basket/i
// "Pour-over", "Dripper" or "V60" match, "Kettle" doesn't: https://regex101.com/?regex=dripper%7Cpour.%3Fover%7Cv60&flags=i&testString=Pour-over
export const DRIPPER_KIND = /dripper|pour.?over|v60|chemex|aeropress|kalita|clever|origami|melitta/i

/** Gear of one kind that isn't retired */
export const activeGear = (gear: Gear[], re: RegExp): Gear[] => gear.filter(g => re.test(g.kind) && g.status !== 'Retired')

/** Each name once (two items can share one), and a preset value stays selectable even if that gear was since retired or removed */
export const withCurrent = (opts: string[], cur: string): string[] => {
  const unique = [...new Set(opts)]
  return cur && !unique.includes(cur) ? [cur, ...unique] : unique
}
