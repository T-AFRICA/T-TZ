/** Skeleton shown while an account page loads its data (same frame, no layout jump). */
export default function AccountLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your account" className="space-y-4 md:space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[#e9e9ec]" />
        <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-[#e9e9ec]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-[#e9e9ec]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-2xl bg-white" />
      <div className="h-44 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
