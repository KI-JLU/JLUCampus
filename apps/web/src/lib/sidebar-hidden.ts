/**
 * The sidebar to save after editing it on a device that hides some of its components (desktop
 * components in the browser). The sidebar is saved as a whole list, so the hidden ids of the saved
 * sidebar go back in: each after the visible entry it followed before, or first when none of those
 * is left. Hidden ids that `next` already holds stay where they are.
 */
export function keepHiddenIds(
  next: readonly string[],
  saved: readonly string[],
  hidden: ReadonlySet<string>
): string[] {
  const result = [...next]
  // Where the next hidden id goes: behind the last visible entry of `saved` seen so far.
  let insertAt = 0
  for (const id of saved) {
    if (hidden.has(id)) {
      if (!result.includes(id)) result.splice(insertAt++, 0, id)
      continue
    }
    const index = result.indexOf(id)
    if (index >= 0) insertAt = index + 1
  }
  return result
}
