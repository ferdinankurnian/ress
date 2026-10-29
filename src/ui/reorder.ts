/** Move an item while preserving the relative order of every other item. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (target === from) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}
