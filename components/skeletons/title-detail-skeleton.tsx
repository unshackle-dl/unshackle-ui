import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Star, Play, ArrowLeft } from 'lucide-react';

export function TitleDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Title Information */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start space-x-4">
                <Skeleton className="w-[120px] h-[180px] rounded-lg flex-shrink-0" />

                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-5 w-48" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-12 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>

                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-12 rounded-full" />
                      <Skeleton className="h-6 w-14 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-12 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-5 w-16 rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with ratings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5" />
                <span>Ratings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-12" />
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-10" />
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Streaming Availability Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Streaming Availability</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Monetization</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Audio Technology</TableHead>
                  <TableHead>Subtitle Languages</TableHead>
                  <TableHead>Audio Languages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-8 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-8 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-6 rounded-full" />
                        <Skeleton className="h-5 w-6 rounded-full" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-6 rounded-full" />
                        <Skeleton className="h-5 w-6 rounded-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
