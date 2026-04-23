import { useState, useMemo } from "react";

export type SortDir = "asc" | "desc";

export function useSort<T>(rows: T[], defaultCol: keyof T | null = null, defaultDir: SortDir = "asc") {
  const [sortCol, setSortCol] = useState<keyof T | null>(defaultCol);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(col: keyof T) {
    if (sortCol === col) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? 1 : -1;
      if (bv == null) return sortDir === "asc" ? -1 : 1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === "asc" ? -1 : 1;
      if (as > bs) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir]);

  return { sorted, sortCol, sortDir, toggle };
}
