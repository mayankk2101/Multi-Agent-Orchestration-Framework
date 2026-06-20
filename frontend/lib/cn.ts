/**
 * Tiny class-name joiner. Filters out falsy values so conditional
 * classes can be written inline without pulling in a dependency.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
