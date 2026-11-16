import { Skeleton, VisuallyHidden } from "@tronic/ui";

export default function ConsoleLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <VisuallyHidden>
        <span role="status">Loading…</span>
      </VisuallyHidden>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
