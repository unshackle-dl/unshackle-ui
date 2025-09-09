# JustWatch Search - Next.js Version

A modern web application for searching movies and TV shows across multiple platforms. This Next.js version provides comprehensive search functionality across JustWatch, TMDB, and SIMKL APIs with intelligent caching, rating aggregation, and streaming availability information.

## Features

- 🔍 **Multi-Source Search**: Search across JustWatch, TMDB, and SIMKL simultaneously
- ⚡ **Fast Performance**: SQLite caching with intelligent TTL management
- 🎯 **Smart Deduplication**: Merge results from different sources intelligently
- ⭐ **Rating Aggregation**: Display ratings from multiple sources (SIMKL, IMDb, TMDB)
- 🎬 **Streaming Info**: Real-time pricing and availability from JustWatch
- 📱 **Responsive Design**: Modern UI with Tailwind CSS and Shadcn UI
- 🐳 **Docker Ready**: Easy deployment with Docker and Docker Compose
- 🔒 **API Security**: Server-side API key management

## Quick Start

### Prerequisites

- Node.js 18+
- API keys for:
  - [TMDB](https://www.themoviedb.org/settings/api)
  - [SIMKL](https://simkl.com/settings/developer/)

### Development Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Local: http://localhost:3000
   - Network: http://your-ip:3000

### Production Deployment

#### Using Docker (Recommended)

1. **Build and run with Docker Compose:**

   ```bash
   # Create environment file
   cp .env.example .env
   # Edit .env with your API keys

   # Start the application
   docker-compose up -d
   ```

2. **Access the application:**
   - http://localhost:3000

#### Manual Deployment

1. **Build the application:**

   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## API Endpoints

- `GET /api/search?q=<query>` - Multi-source search
- `GET /api/title/:id?source=<source>` - Title details with pricing
- `GET /api/ratings/:imdbId` - Rating information
- `GET /api/health` - Health check endpoint

## Configuration

### Environment Variables

| Variable                 | Description                  | Default           |
| ------------------------ | ---------------------------- | ----------------- |
| `TMDB_API_KEY`           | The Movie Database API key   | Required          |
| `SIMKL_API_KEY`          | SIMKL API key                | Required          |
| `DATABASE_PATH`          | SQLite database file path    | `./data/cache.db` |
| `DEFAULT_COUNTRY`        | Default country for searches | `US`              |
| `MAX_RESULTS_PER_SOURCE` | Max results per API source   | `20`              |
| `ENABLE_DEDUPLICATION`   | Enable result deduplication  | `true`            |
| `CACHE_TTL_SEARCH`       | Search cache TTL (seconds)   | `3600`            |

## Self-Hosting

Perfect for deployment on your own server with Node.js support.

### System Requirements

- **CPU**: 1 vCPU minimum, 2 vCPU recommended
- **RAM**: 512MB minimum, 1GB recommended
- **Storage**: 1GB minimum
- **Network**: Stable internet connection for API calls

## Credits

- **APIs**: JustWatch, The Movie Database (TMDB), SIMKL
- **UI Components**: Shadcn UI, Tailwind CSS
- **Framework**: Next.js
