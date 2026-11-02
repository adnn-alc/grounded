// Grinder speed choices offered in Settings and the shot/brew edit forms
export const RPM_OPTIONS: string[] = ['manual', '500', '600', '700', '800', '900', '1000', '1100', '1200', '1300', '1400', '1500', '1600']

/** How a choice reads in a picker: 'Manual' or '800 RPM' */
export const rpmLabel = (r: string): string => r === 'manual' ? 'Manual' : `${r} RPM`
