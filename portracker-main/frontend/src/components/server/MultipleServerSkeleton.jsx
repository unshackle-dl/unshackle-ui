import { ServerSectionSkeleton } from "./ServerSectionSkeleton";

export function MultipleServerSkeleton({ count = 2 }) {
  return (
    <div className="space-y-8">
      {Array.from({ length: count }).map((_, i) => (
        <ServerSectionSkeleton key={i} />
      ))}
    </div>
  );
}
