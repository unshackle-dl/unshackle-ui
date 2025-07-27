import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ServicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Service Configuration</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Streaming Services</CardTitle>
          <CardDescription>
            Configure and manage your streaming service connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Service management interface will be implemented here with authentication and health monitoring.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}