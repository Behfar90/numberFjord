import type { JsonStatDataset } from "@/lib/ssb";

export interface Row {
  labels: Record<string, string>;
  value: number | null;
}

// JSON-stat stores values row-major: the last dimension changes fastest.
export function toRows(dataset: JsonStatDataset): Row[] {
  const dims = dataset.id.map((code) => {
    const { index, label } = dataset.dimension[code].category;
    const codes = Object.keys(index).sort((a, b) => index[a] - index[b]);
    return { code, values: codes.map((c) => label[c] ?? c) };
  });

  return dataset.value.map((value, i) => {
    const labels: Record<string, string> = {};
    let rest = i;
    for (let d = dims.length - 1; d >= 0; d--) {
      const { code, values } = dims[d];
      labels[code] = values[rest % values.length];
      rest = Math.floor(rest / values.length);
    }
    return { labels, value };
  });
}
