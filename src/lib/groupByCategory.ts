/** Any product-like item with a category name attached, for grouping in pickers. */
interface CategorizedItem {
  category: { name: string } | null;
}

export interface CategoryGroup<T> {
  categoryName: string;
  items: T[];
}

/**
 * Groups a flat product list into category buckets for grouped `<Select>` rendering.
 * Category groups are sorted alphabetically; items within a group keep their incoming
 * order (callers already sort products by name before this runs).
 */
export function groupByCategory<T extends CategorizedItem>(items: T[]): CategoryGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const name = item.category?.name ?? "Uncategorized";
    const bucket = groups.get(name);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(name, [item]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryName, groupItems]) => ({ categoryName, items: groupItems }));
}
