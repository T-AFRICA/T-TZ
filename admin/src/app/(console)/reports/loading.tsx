import { Skeleton, VisuallyHidden } from "@tronic/ui";

/**
 * Shown while the countries are being asked: the page's own outline (title,
 * filter bar, eight figures, charts, table), so nothing jumps when the
 * figures arrive. No number is shown until it is a real one.
 */
export default function GlobalReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <VisuallyHidden>
        <span role="status">Reading every country&apos;s figures…</span>
      </VisuallyHidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </div>
      <Skeleton className="h-[6.25rem] w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
          <Skeleton key={item} className="h-[6.75rem] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Skeleton className="h-96 w-full rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 w-full rounded-xl xl:col-span-2" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
