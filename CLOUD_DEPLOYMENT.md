# Cloud Server Setup Guide

## Quick Start on Any Cloud Provider (EC2, DigitalOcean, Linode, etc.)

### 1. Prerequisites
- Server with Docker & Docker Compose installed
- Firewall/security group with ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) open to 0.0.0.0/0

### 2. Clone and Setup
```bash
git clone <your-repo>
cd brimble-interview/backend
```

### 3. Configure Environment

Copy the example env file and edit it:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Uncomment and update these key variables for your public IP:**

```bash
# CORS - allow your public IP (replace <YOUR_PUBLIC_IP> with your actual IP)
CORS_ORIGIN=http://<YOUR_PUBLIC_IP>,http://localhost

# Base domain for deployed apps (use nip.io for automatic wildcard DNS)
# This gives you URLs like: my-app-12345678.<YOUR_PUBLIC_IP>.nip.io
BRIMBLE_APPS_BASE_DOMAIN=<YOUR_PUBLIC_IP>.nip.io

# Public base for app access
BRIMBLE_APP_PUBLIC_BASE=http://<YOUR_PUBLIC_IP>
```

**To find your public IP:**
```bash
# On AWS EC2
curl -s http://169.254.169.254/latest/meta-data/public-ipv4

# Or use an external service
curl -s ifconfig.me
```

### 4. Start Services

From the project root (brimble-interview/):
```bash
cd ..
docker compose up -d --build
```

### 5. Access the UI

Open your browser to: `http://your-public-ip`

Deployed apps will be available at: `http://your-app-name-12345678.your-ip.nip.io`

## Example Complete .env for Cloud Deployment

```bash
HOST=0.0.0.0
PORT=3000
DATABASE_URL="file:/data/brimble.db"
CADDY_ADMIN_URL=http://caddy:2019
CADDY_DYNAMIC_DIR=/etc/caddy/dynamic
CADDYFILE_PATH=/etc/caddy/Caddyfile
PIPELINE_BUILD_TIMEOUT_MS=3600000
PIPELINE_STAGE_TIMEOUT_MS=120000
BRIMBLE_WORKSPACE=/data/work
RAILPACK_BIN=railpack
BUILDKIT_HOST=tcp://buildkit:1234
BRIMBLE_REGISTRY_PUSH_HOST=registry:5000
BRIMBLE_REGISTRY_PULL_HOST=127.0.0.1:5001
GIT_TOKEN=
DOCKER_SOCKET_PATH=/var/run/docker.sock
BRIMBLE_HOST_PORT_MIN=10000
BRIMBLE_HOST_PORT_MAX=11000
BRIMBLE_CONTAINER_PORT=3000
BRIMBLE_HEALTH_POLL_MS=15000
BRIMBLE_DOCKER_UPSTREAM_HOST=host.docker.internal

# Cloud-Specific Configuration (replace <YOUR_PUBLIC_IP> with your actual public IP)
CORS_ORIGIN=http://<YOUR_PUBLIC_IP>,http://localhost
BRIMBLE_APPS_BASE_DOMAIN=<YOUR_PUBLIC_IP>.nip.io
BRIMBLE_APP_PUBLIC_BASE=http://<YOUR_PUBLIC_IP>
```

## Troubleshooting

### "Connection refused" or blank page
1. Check firewall/security group rules (port 80 must be open to 0.0.0.0/0)
2. Verify containers are running: `docker compose ps`
3. Check Caddy logs: `docker compose logs caddy`
4. Check backend logs: `docker compose logs backend`

### CORS errors
Make sure `CORS_ORIGIN` in `backend/.env` includes your public IP with `http://` prefix.

### Deployments not accessible
The base domain uses nip.io for wildcard DNS. If `your-ip.nip.io` doesn't resolve:
- Check that `BRIMBLE_APPS_BASE_DOMAIN` is set correctly in backend/.env
- You can use a custom domain and point A records to your server IP

### Registry/build issues
The local registry is bound to 127.0.0.1:5001 for security. This should work as-is.

## Using a Custom Domain (Optional)

Instead of nip.io, you can use a real domain:

1. Point a wildcard A record to your server IP: `*.apps.yourdomain.com`
2. Set `BRIMBLE_APPS_BASE_DOMAIN=apps.yourdomain.com`
3. Update `CORS_ORIGIN` to include `http://apps.yourdomain.com`

## Production Considerations

For production use:
1. Use a real domain instead of nip.io
2. Enable HTTPS (remove `auto_https off` from Caddyfile, use Let's Encrypt)
3. Use a proper database (PostgreSQL) instead of SQLite
4. Set up proper logging and monitoring
5. Consider using a container orchestration platform (ECS, Kubernetes)
