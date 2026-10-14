import { formatValue } from "./visual-data";

export function VisualTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-background sticky top-0">
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="text-muted-foreground px-2 py-1.5 text-left font-medium first:pl-0"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    typeof cell === "string"
                      ? "px-2 py-1.5 first:pl-0"
                      : "px-2 py-1.5 text-right tabular-nums"
                  }
                >
                  {formatValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
