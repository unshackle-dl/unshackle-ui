# Unshackle UI

A modern web interface for [Unshackle](https://github.com/unshackle-dl/unshackle) - the movie, TV, and music archival software.

<p align="center">
  <img width="16" height="16" alt="no_encryption" src="https://github.com/user-attachments/assets/6ff88473-0dd2-4bbc-b1ea-c683d5d7a134" /> unshackle-ui
  <br/>
  <sup><em>Web Interface for Content Discovery and Download Management</em></sup>
</p>

## Overview

Unshackle UI provides a modern, responsive web interface for managing your Unshackle CLI operations. Built with a search-first approach, it enables easy content discovery, multi-service searching, and real-time download management.

### Key Features

- 🔍 **TMDB-Enhanced Search** - Rich content discovery with posters and metadata
- 🌐 **Multi-Service Support** - Search across multiple streaming services simultaneously
- 📥 **Real-time Downloads** - Live progress tracking and queue management
- 🎨 **Modern Design** - Clean, responsive interface inspired by PortraTracker
- 🌙 **Dark/Light Mode** - Adaptive theming for any environment
- 🔔 **Smart Notifications** - Toast alerts for download status and completion
- ⚙️ **Quality Control** - Advanced download options (HDR10, Dolby Vision, Atmos)

## Architecture

### Deployment Strategy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Unshackle     │    │  Unshackle UI   │    │     User        │
│   CLI (API)     │◄──►│   Frontend      │◄──►│   Browser       │
│                 │    │                 │    │                 │
│ Port: 8888      │    │ Port: 3000      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Requirements:**
- Unshackle CLI running in API mode (`unshackle api --host 0.0.0.0 --port 8888`)
- Unshackle UI frontend (React application)
- TMDB API key for content metadata enrichment

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern UI framework with type safety |
| **Build Tool** | Vite | Fast development and optimized builds |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Components** | Shadcn UI | High-quality, accessible components |
| **State Management** | Zustand | Lightweight, reactive state |
| **API Client** | TanStack Query | Powerful data fetching and caching |
| **Notifications** | Sonner | Beautiful toast notifications |
| **Real-time** | WebSocket + Polling | Live updates and progress tracking |

### External APIs

| Service | Purpose | Usage |
|---------|---------|-------|
| **Unshackle CLI API** | Core functionality | Search, download, queue management |
| **TMDB API v3** | Content metadata | Posters, descriptions, ratings, cast |

## Project Structure

```
unshackle-ui/
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md           # Detailed system architecture
│   ├── API_INTEGRATION.md        # API integration guide
│   ├── COMPONENT_GUIDE.md        # Component usage and patterns
│   ├── DEPLOYMENT.md             # Deployment instructions
│   └── DEVELOPMENT.md            # Development setup guide
├── src/
│   ├── components/               # React components
│   │   ├── ui/                  # Shadcn UI base components
│   │   ├── layout/              # Layout components
│   │   ├── search/              # Search-related components
│   │   ├── downloads/           # Download management
│   │   ├── services/            # Service management
│   │   └── common/              # Shared components
│   ├── hooks/                   # Custom React hooks
│   │   ├── api/                # API-specific hooks
│   │   ├── ui/                 # UI-specific hooks
│   │   └── utils/              # Utility hooks
│   ├── lib/                     # Core libraries and utilities
│   │   ├── api/                # API clients
│   │   ├── types/              # TypeScript definitions
│   │   ├── utils/              # Helper functions
│   │   └── constants/          # Application constants
│   ├── stores/                  # Zustand state stores
│   ├── pages/                   # Page components
│   ├── styles/                  # Global styles and themes
│   └── assets/                  # Static assets
├── public/                      # Public assets
├── tests/                       # Test files
├── .env.example                 # Environment variables template
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Quick Start

### Prerequisites

1. **Unshackle CLI installed and configured**
   ```bash
   # Install Unshackle
   git clone https://github.com/unshackle-dl/unshackle.git
   cd unshackle
   uv sync
   
   # Start in API mode
   uv run unshackle api --host 0.0.0.0 --port 8888 --api-key your-secure-key
   ```

2. **TMDB API Key**
   - Register at [themoviedb.org](https://www.themoviedb.org/settings/api)
   - Get your API key from the settings

### Installation

```bash
# Clone the UI repository
git clone https://github.com/unshackle-dl/unshackle-ui.git
cd unshackle-ui

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys and URLs

# Start development server
npm run dev
```

### Environment Configuration

```bash
# .env.local
VITE_UNSHACKLE_API_URL=http://localhost:8888
VITE_UNSHACKLE_API_KEY=your-secure-key
VITE_TMDB_API_KEY=your-tmdb-api-key
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3
VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

## User Experience Design

### Search-First Workflow

The UI is designed around a search-first approach optimized for content discovery:

1. **Content Discovery**: Start with TMDB search for rich metadata
2. **Service Selection**: Choose which streaming services to search
3. **Multi-Service Search**: Parallel searching across selected services
4. **Result Aggregation**: Unified view of all available sources
5. **Quality Selection**: Choose resolution and advanced options
6. **Download Management**: Real-time progress and queue management

### Design Philosophy

- **Minimal Cognitive Load**: Search → Select → Download
- **Rich Visual Feedback**: Posters, progress bars, status indicators
- **Responsive Design**: Works on desktop and tablet (mobile future consideration)
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Performance**: Optimized loading with smart caching

## Core Features

### 1. Enhanced Content Search

```typescript
// Search workflow
TMDB Search → Title Selection → Multi-Service Query → Result Aggregation
```

**Features:**
- Real-time TMDB search with autocomplete
- Rich content cards with posters and metadata
- Multi-service parallel searching
- Intelligent result matching and deduplication

### 2. Advanced Download Options

**Quality Selection:**
- Resolution: 720p, 1080p, 4K
- HDR: HDR10, Dolby Vision
- Audio: Dolby Atmos, multi-language tracks
- Subtitles: Multiple languages and formats

**Smart Options:**
- Service-aware quality availability
- Preview of available options before download
- Bulk download configuration

### 3. Real-time Download Management

**Live Updates:**
- WebSocket connections for instant updates
- Polling fallback for reliability
- Progress bars and status indicators
- Queue management with drag-and-drop reordering

**Notifications:**
- Toast notifications for status changes
- Browser notifications for completed downloads
- Error handling with retry options

### 4. Service Management

**Status Monitoring:**
- Service health checks
- Authentication status
- Rate limiting indicators
- Configuration management

## Development

### Component Architecture

The application follows a modular component architecture:

```typescript
// Component hierarchy
App
├── Layout
│   ├── Header (logo, theme, status)
│   ├── Navigation (tabs, search)
│   └── StatusBar (real-time indicators)
├── Pages
│   ├── SearchPage (main interface)
│   ├── QueuePage (download management)
│   └── ServicesPage (configuration)
└── Modals
    ├── DownloadOptions
    ├── ServiceAuth
    └── Settings
```

### State Management Strategy

```typescript
// Store architecture
├── searchStore (TMDB + service search)
├── downloadStore (queue + progress)
├── serviceStore (auth + health)
├── uiStore (theme + preferences)
└── notificationStore (toasts + alerts)
```

### API Integration Patterns

**Unshackle CLI API:**
- REST endpoints for CRUD operations
- WebSocket for real-time updates
- Error handling with retry logic
- Rate limiting and queue management

**TMDB API:**
- Content search and discovery
- Metadata enrichment
- Image optimization and caching
- Fallback for missing data

## Planned Features

### Phase 1 (MVP)
- ✅ TMDB-enhanced search interface
- ✅ Multi-service search capability
- ✅ Basic download queue management
- ✅ Real-time progress tracking

### Phase 2 (Enhanced UX)
- 🔄 Advanced filtering and sorting
- 🔄 Bulk download operations
- 🔄 Download history and analytics
- 🔄 Custom download profiles

### Phase 3 (Advanced Features)
- 📋 Watchlist and favorites
- 📋 Automated quality selection
- 📋 Integration with media servers (Plex, Jellyfin)
- 📋 Mobile-responsive design
- 📋 Multi-user support

### Phase 4 (Power User Features)
- 📋 Custom service integrations
- 📋 Advanced scheduling
- 📋 Content recommendation engine
- 📋 API webhooks and automation

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and contribution process.

## Documentation

- [📐 Architecture Guide](docs/ARCHITECTURE.md) - System design and patterns
- [🔌 API Integration](docs/API_INTEGRATION.md) - API usage and patterns
- [🧩 Component Guide](docs/COMPONENT_GUIDE.md) - Component usage and styling
- [🚀 Deployment](docs/DEPLOYMENT.md) - Production deployment guide
- [⚙️ Development Setup](docs/DEVELOPMENT.md) - Local development guide

## License

This software is licensed under the terms of [GNU General Public License, Version 3.0](LICENSE).

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/unshackle-dl/unshackle-ui/issues)
- 💬 [Discussions](https://github.com/unshackle-dl/unshackle-ui/discussions)
- 🔗 [Unshackle CLI](https://github.com/unshackle-dl/unshackle)