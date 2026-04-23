import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/hooks/use-sort";

interface SortableHeaderProps {
  label: string;
  column: string;
  sortCol: string | null;
  sortDir: SortDir;
  onSort: (col: any) => void;
  className?: string;
}

export function SortableHeader({ label, column, sortCol, sortDir, onSort, className }: SortableHeaderProps) {
  const active = sortCol === column;
  return (
    <TableHead
      className={cn("cursor-pointer select-none whitespace-nowrap group", className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc"
            ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
            : <ArrowDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </TableHead>
  );
}
