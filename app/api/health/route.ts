import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    // Check database connection
    const db = getDatabase();
    db.exec('SELECT 1');

    // Check environment variables
    const requiredEnvVars = ['TMDB_API_KEY', 'SIMKL_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
      },
      services: {
        justwatch: 'available',
        tmdb: process.env.TMDB_API_KEY ? 'configured' : 'missing_key',
        simkl: process.env.SIMKL_API_KEY ? 'configured' : 'missing_key',
      },
    };

    const statusCode = missingEnvVars.length > 0 ? 503 : 200;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
