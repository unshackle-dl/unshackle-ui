import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Download History</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Past Downloads</CardTitle>
          <CardDescription>
            View and manage your download history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Download history will be implemented here with filters and search capabilities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}