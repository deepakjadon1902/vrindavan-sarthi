import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export const RECORDS_PER_PAGE = 10;

export const useRecordPagination = <T,>(items: T[], resetKeys: unknown[] = []) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / RECORDS_PER_PAGE));

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKeys);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * RECORDS_PER_PAGE;
    return items.slice(start, start + RECORDS_PER_PAGE);
  }, [items, page]);

  return { page, setPage, pageItems, totalPages, pageSize: RECORDS_PER_PAGE };
};

type RecordPaginationProps = {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

const RecordPagination = ({ page, total, pageSize = RECORDS_PER_PAGE, onPageChange }: RecordPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-body text-xs text-muted-foreground">
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 font-body text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 hover:bg-muted"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="min-w-20 text-center font-body text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 font-body text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 hover:bg-muted"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default RecordPagination;
