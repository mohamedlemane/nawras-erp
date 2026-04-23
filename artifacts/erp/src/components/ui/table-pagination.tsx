import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ page, totalPages, total, pageSize, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <span className="text-sm text-muted-foreground">
        {from}–{to} sur {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
