// Converts Vietnamese (or any) text to a URL-safe slug. Uses NFD
// normalization + a Unicode "Mark" property regex to strip combining
// diacritics, so it works for the whole Vietnamese alphabet without
// hand-listing every accented character.
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
