# API Setup Guide

## Required API Keys

To use all features of the Multi-API Search application, you'll need to obtain API keys from the following services:

### 1. TMDB (The Movie Database) API

- **Website**: https://www.themoviedb.org/
- **Documentation**: https://developer.themoviedb.org/docs
- **Steps**:
  1. Create a free account at https://www.themoviedb.org/signup
  2. Go to your account settings → API
  3. Request an API key (choose "Developer" for personal use)
  4. Copy your API key

### 2. SIMKL API

- **Website**: https://simkl.com/
- **Documentation**: https://simkl.docs.apiary.io/
- **Steps**:
  1. Create a free account at https://simkl.com/signup
  2. Go to https://simkl.com/settings/developer/
  3. Create a new application
  4. Copy your Client ID (this is your API key)

## Configuration

### Option 1: Environment Variables (Recommended for Docker)

Set these environment variables when running the Docker container:

```bash
docker run -d -p 80:80 \
  -e TmdbApiKey="your_tmdb_api_key_here" \
  -e SimklApiKey="your_simkl_api_key_here" \
  your-justwatch-search:latest
```

### Option 2: appsettings.json (For Development)

Update the `appsettings.json` or `appsettings.Development.json` files:

```json
{
  "TmdbApiKey": "your_tmdb_api_key_here",
  "SimklApiKey": "your_simkl_api_key_here"
}
```

## Features Enabled by Each API

- **JustWatch**: Streaming availability, pricing information, direct links
- **TMDB**: Comprehensive movie/TV metadata, ratings, cast info, images
- **SIMKL**: Additional metadata, user tracking capabilities, anime support

## Rate Limits

- **TMDB**: 40 requests per 10 seconds per IP address
- **SIMKL**: 1000 requests per day for free accounts
- **JustWatch**: Uses CORS proxies, no specific limits but respectful usage recommended

## Notes

- The application will work with JustWatch only if other API keys are not configured
- TMDB and SIMKL provide additional metadata and cross-referencing capabilities
- All APIs are called in parallel for better performance
- Results are automatically deduplicated using IMDB IDs when available
