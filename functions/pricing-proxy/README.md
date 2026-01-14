# VCF Pricing Proxy

IBM Cloud Functions serverless proxy for fetching IBM Cloud pricing data.

## Purpose

This function acts as a secure proxy between the VCF Migration frontend and the IBM Cloud Global Catalog API:

- **Security**: Keeps API credentials server-side (not exposed in browser)
- **Caching**: Reduces API calls with 1-hour cache
- **Reliability**: Returns cached/default data if API is unavailable
- **CORS**: Handles cross-origin requests from the frontend

## Quick Start

### Prerequisites

1. IBM Cloud CLI installed
2. Cloud Functions plugin installed
3. Logged into IBM Cloud

```bash
# Install Cloud Functions plugin
ibmcloud plugin install cloud-functions

# Login to IBM Cloud
ibmcloud login --sso

# Target a region
ibmcloud target -r us-south
```

### Deploy

```bash
# Set your API key (optional - enables live pricing)
export IBM_CLOUD_API_KEY="your-api-key"

# Make deploy script executable
chmod +x deploy.sh

# Deploy
./deploy.sh
```

### Output

After deployment, you'll receive a URL like:

```
https://us-south.functions.cloud.ibm.com/api/v1/web/abc123/default/vcf-pricing-proxy
```

Add this to your frontend `.env`:

```
VITE_PRICING_PROXY_URL=https://us-south.functions.cloud.ibm.com/api/v1/web/abc123/default/vcf-pricing-proxy
```

## API Usage

### Get Pricing Data

```bash
curl https://your-function-url
```

Response:

```json
{
  "version": "2026-01-13",
  "lastUpdated": "2026-01-13T10:30:00.000Z",
  "source": "ibm-cloud-functions-proxy",
  "cached": false,
  "regions": { ... },
  "vsiProfiles": { ... },
  "blockStorage": { ... },
  "bareMetal": { ... },
  "networking": { ... }
}
```

### Force Refresh

```bash
curl 'https://your-function-url?refresh=true'
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `IBM_CLOUD_API_KEY` | IBM Cloud API key for authenticated requests | No |

Without an API key, the function returns default pricing data.

### Cache Settings

- **TTL**: 1 hour (configurable in `index.js`)
- **Warm invocations**: Cache persists across invocations
- **Cold starts**: Cache is rebuilt

## Local Testing

```bash
# Test without API key
node test.js

# Test with API key
IBM_CLOUD_API_KEY=your-key node test.js
```

## Manual Deployment

If you prefer manual deployment over the script:

```bash
# Create namespace
ibmcloud fn namespace create vcf-migration

# Target namespace
ibmcloud fn namespace target vcf-migration

# Deploy function
ibmcloud fn action create vcf-pricing-proxy index.js \
  --kind nodejs:18 \
  --web true \
  --timeout 30000 \
  --memory 256

# Bind API key (optional)
ibmcloud fn action update vcf-pricing-proxy \
  --param IBM_CLOUD_API_KEY "your-api-key"

# Get URL
ibmcloud fn action get vcf-pricing-proxy --url
```

## Cost

IBM Cloud Functions free tier includes:

- 5 million executions/month
- 400,000 GB-seconds/month

For a typical frontend app, this is essentially free.

## Troubleshooting

### Function returns 500 error

Check logs:

```bash
ibmcloud fn activation list --limit 5
ibmcloud fn activation logs <activation-id>
```

### CORS errors in browser

Verify the function was deployed with `--web true`:

```bash
ibmcloud fn action get vcf-pricing-proxy
```

### Stale pricing data

Force a refresh:

```bash
curl 'https://your-function-url?refresh=true'
```

Or redeploy the function to clear the cache.
