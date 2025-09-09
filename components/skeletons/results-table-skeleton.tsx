import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export function ResultsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Poster</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-20 text-center">Year</TableHead>
              <TableHead className="w-24 text-center">Rating</TableHead>
              <TableHead className="w-32">External Links</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index} className="h-[100px]">
                <TableCell className="py-2">
                  <div className="flex justify-start">
                    <Skeleton className="w-[60px] h-[90px] rounded-md" />
                  </div>
                </TableCell>

                <TableCell className="align-middle">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>

                <TableCell className="font-medium align-middle">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </TableCell>

                <TableCell className="text-center align-middle">
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>

                <TableCell className="text-center align-middle">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Skeleton className="h-4 w-8" />
                    </div>
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                </TableCell>

                <TableCell className="align-middle">
                  <div className="flex flex-wrap gap-1">
                    <Skeleton className="h-7 w-12 rounded" />
                    <Skeleton className="h-7 w-14 rounded" />
                    <Skeleton className="h-7 w-18 rounded" />
                  </div>
                </TableCell>

                <TableCell className="align-middle">
                  <Skeleton className="h-7 w-12 rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}
