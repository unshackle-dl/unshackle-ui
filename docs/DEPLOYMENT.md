# Deployment Guide

Comprehensive deployment guide for Unshackle UI across different environments.

## Overview

Unshackle UI can be deployed in various configurations to meet different needs:

1. **Development**: Local development with hot reload
2. **Self-hosted**: Single server deployment for personal use
3. **Docker**: Containerized deployment for easy management
4. **Cloud**: Scalable cloud deployment options

## Prerequisites

### System Requirements

**Minimum:**
- 1 CPU core
- 512MB RAM
- 1GB storage

**Recommended:**
- 2+ CPU cores
- 2GB+ RAM
- 5GB+ storage (for downloads)

### Dependencies

1. **Unshackle CLI** - Must be accessible and running in API mode
2. **TMDB API Key** - For content metadata
3. **Web Server** - Nginx, Apache, or similar for production

## Build Configuration

### Environment Variables

Create appropriate environment files for each deployment environment:

#### Development (.env.local)
```bash
# Unshackle API
VITE_UNSHACKLE_API_URL=http://localhost:8888
VITE_UNSHACKLE_API_KEY=development-key

# TMDB API
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3
VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500

# Development settings
VITE_APP_ENV=development
VITE_LOG_LEVEL=debug
VITE_DEBUG_API=true
```

#### Production (.env.production)
```bash
# Unshackle API
VITE_UNSHACKLE_API_URL=http://your-server:8888
VITE_UNSHACKLE_API_KEY=your_secure_production_key

# TMDB API
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3
VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500

# Production settings
VITE_APP_ENV=production
VITE_LOG_LEVEL=error
VITE_DEBUG_API=false
```

### Build Process

```bash
# Install dependencies
npm ci --production=false

# Build for production
npm run build

# The built files will be in the `dist` directory
```

## Deployment Methods

### 1. Self-Hosted Deployment

#### Option A: Direct Server Deployment

**Step 1: Prepare the Server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install nginx
sudo apt install nginx -y

# Install PM2 for process management
sudo npm install -g pm2
```

**Step 2: Deploy the Application**
```bash
# Create application directory
sudo mkdir -p /var/www/unshackle-ui
sudo chown $USER:$USER /var/www/unshackle-ui

# Clone and build
cd /var/www/unshackle-ui
git clone https://github.com/unshackle-dl/unshackle-ui.git .
npm ci
npm run build

# Configure environment
cp .env.example .env.production
# Edit .env.production with your settings
```

**Step 3: Configure Nginx**
```nginx
# /etc/nginx/sites-available/unshackle-ui
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain
    
    root /var/www/unshackle-ui/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss application/atom+xml image/svg+xml;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Static files with long-term caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # API proxy to Unshackle CLI
    location /api/ {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket proxy for real-time updates
    location /ws {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Error pages
    error_page 404 /index.html;
}
```

**Step 4: Enable Site and SSL**
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/unshackle-ui /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install SSL certificate (optional but recommended)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### Option B: Static File Hosting

For simpler deployments where you want to serve static files only:

```bash
# Build the application
npm run build

# Copy files to web server
sudo cp -r dist/* /var/www/html/

# Configure web server to serve SPA
# (Add try_files directive for SPA routing)
```

### 2. Docker Deployment

#### Single Container Setup

**Dockerfile:**
```dockerfile
# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf for Docker:**
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

**Build and Run:**
```bash
# Build Docker image
docker build -t unshackle-ui .

# Run container
docker run -d \
  --name unshackle-ui \
  -p 3000:80 \
  --restart unless-stopped \
  unshackle-ui

# Check logs
docker logs unshackle-ui
```

#### Docker Compose Setup

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  unshackle-ui:
    build: .
    container_name: unshackle-ui
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - unshackle-api
    
  unshackle-api:
    image: unshackle-cli:latest  # Assuming you have Unshackle CLI containerized
    container_name: unshackle-api
    ports:
      - "8888:8888"
    environment:
      - UNSHACKLE_API_KEY=your-secure-key
    volumes:
      - ./downloads:/app/downloads
      - ./config:/app/config
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: unshackle-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - unshackle-ui
      - unshackle-api
    restart: unless-stopped

volumes:
  downloads:
  config:
```

**Start with Docker Compose:**
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f unshackle-ui
```

### 3. Cloud Deployment

#### Vercel Deployment

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Deploy to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_UNSHACKLE_API_URL
vercel env add VITE_UNSHACKLE_API_KEY
vercel env add VITE_TMDB_API_KEY
```

#### Netlify Deployment

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[context.production.environment]
  NODE_ENV = "production"
```

**Deploy to Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Set environment variables
netlify env:set VITE_UNSHACKLE_API_URL your_api_url
netlify env:set VITE_UNSHACKLE_API_KEY your_api_key
netlify env:set VITE_TMDB_API_KEY your_tmdb_key
```

## Production Configuration

### Security Considerations

#### API Security

```bash
# Generate strong API key for production
openssl rand -hex 32

# Set up API key rotation
# Consider using environment-specific keys
```

#### HTTPS Configuration

```nginx
# Force HTTPS redirect
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Rest of configuration...
}
```

#### Content Security Policy

```nginx
# Add CSP header
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline' fonts.googleapis.com;
    font-src 'self' fonts.gstatic.com;
    img-src 'self' data: image.tmdb.org;
    connect-src 'self' api.themoviedb.org;
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
" always;
```

### Performance Optimization

#### Nginx Optimizations

```nginx
# Worker processes
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_types
        application/atom+xml
        application/geo+json
        application/javascript
        application/x-javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rdf+xml
        application/rss+xml
        application/xhtml+xml
        application/xml
        font/eot
        font/otf
        font/ttf
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Brotli compression (if available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        # Rate limiting for API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            # ... rest of API proxy config
        }
    }
}
```

#### CDN Configuration

For better global performance, consider using a CDN:

```nginx
# Add CDN-friendly headers
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
    add_header Vary "Accept-Encoding";
}
```

### Monitoring and Logging

#### Application Monitoring

**Install monitoring tools:**
```bash
# Install Node.js monitoring
npm install -g pm2
pm2 install pm2-logrotate

# Monitor with PM2
pm2 monit
```

#### Log Configuration

**Nginx access logs:**
```nginx
log_format detailed '$remote_addr - $remote_user [$time_local] '
                   '"$request" $status $body_bytes_sent '
                   '"$http_referer" "$http_user_agent" '
                   '$request_time $upstream_response_time';

access_log /var/log/nginx/unshackle-ui.access.log detailed;
error_log /var/log/nginx/unshackle-ui.error.log warn;
```

**Log rotation:**
```bash
# Configure logrotate
sudo tee /etc/logrotate.d/unshackle-ui << EOF
/var/log/nginx/unshackle-ui.*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 \`cat /var/run/nginx.pid\`
        fi
    endscript
}
EOF
```

#### Health Checks

**Application health endpoint:**
```typescript
// Add health check endpoint to your app
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

**Nginx health check:**
```nginx
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

### Backup and Recovery

#### Automated Backups

```bash
#!/bin/bash
# backup-script.sh

BACKUP_DIR="/backup/unshackle-ui"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$TIMESTAMP.tar.gz /var/www/unshackle-ui

# Backup configuration
tar -czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz /etc/nginx/sites-available/unshackle-ui

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
```

**Schedule backups:**
```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /usr/local/bin/backup-script.sh
```

## Troubleshooting

### Common Deployment Issues

#### 1. Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build

# Check for missing environment variables
echo $VITE_UNSHACKLE_API_URL
echo $VITE_TMDB_API_KEY
```

#### 2. API Connection Issues

```bash
# Test API connectivity
curl -H "Authorization: Bearer your-api-key" http://localhost:8888/api/services

# Check firewall rules
sudo ufw status
```

#### 3. Static File Issues

```bash
# Check nginx configuration
sudo nginx -t

# Check file permissions
ls -la /var/www/unshackle-ui/dist/

# Fix permissions if needed
sudo chown -R www-data:www-data /var/www/unshackle-ui/dist/
```

#### 4. WebSocket Connection Issues

```bash
# Test WebSocket connection
wscat -c ws://localhost:8888/ws

# Check nginx WebSocket proxy configuration
```

### Performance Issues

#### 1. Slow Load Times

```bash
# Check compression
curl -H "Accept-Encoding: gzip" -I http://your-domain.com/

# Analyze bundle size
npm run build:analyze
```

#### 2. Memory Issues

```bash
# Monitor memory usage
free -h
htop

# Check nginx worker processes
ps aux | grep nginx
```

### Maintenance

#### Updates

```bash
# Application updates
git pull origin main
npm ci
npm run build
sudo systemctl reload nginx

# Security updates
sudo apt update && sudo apt upgrade -y
```

#### Certificate Renewal

```bash
# Automatic renewal (if using Let's Encrypt)
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
sudo systemctl reload nginx
```

This deployment guide covers all major deployment scenarios and production considerations for Unshackle UI.