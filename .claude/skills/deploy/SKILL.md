---
name: deploy
description: Deploy frontend app and/or Code Engine proxy functions (profiles, pricing, ai)
disable-model-invocation: true
---

# /deploy — Deploy Frontend & Code Engine Proxy Functions

Deploy the VCF Migration frontend app and/or its IBM Code Engine proxy functions.

## Deployment Targets

| Target | Directory | Deploy Method | Prerequisites |
|--------|-----------|---------------|---------------|
| **frontend** | project root | Version bump → test → build → `ibmcloud ce app update` | `IBM_CLOUD_API_KEY` (for CE login) |
| **profiles-proxy** | `functions/profiles-proxy/` | `deploy.sh` | `IBM_CLOUD_API_KEY` |
| **pricing-proxy** | `functions/pricing-proxy/` | `deploy.sh` | Optional |
| **ai-proxy** | `functions/ai-proxy/` | Manual `ibmcloud ce` commands | `WATSONX_PROJECT_ID` (ai-proxy has its own service ID `IBM_CLOUD_API_KEY` — do NOT overwrite) |

## Steps

### 1. Ask what to deploy

Use AskUserQuestion to ask the user what they want to deploy. Options:
- frontend
- profiles-proxy
- pricing-proxy
- ai-proxy
- All four

When **"All four"** is selected, deploy frontend first (most complex), then proxies.

### 2. Check prerequisites

Run these checks and report any failures before proceeding:

```bash
# IBM Cloud CLI installed?
ibmcloud version

# Code Engine plugin installed?
ibmcloud plugin show code-engine

# API key set?
echo "${IBM_CLOUD_API_KEY:+set}"
```

If `IBM_CLOUD_API_KEY` is not set, tell the user:
```
export IBM_CLOUD_API_KEY=your-api-key
```

For **ai-proxy** additionally check:
- `WATSONX_PROJECT_ID` is set (needed only for first-time deploy or project ID change)

**Note**: The ai-proxy already has its own `IBM_CLOUD_API_KEY` (a service ID key) set as an env var. Do NOT overwrite it with your personal API key. After deploying any proxy, verify `ALLOWED_ORIGINS` is set (see Step 6).

### 3. Deploy frontend

#### 3a. Ask release type

Use AskUserQuestion to ask what kind of release this is. Options:
- **Patch** (bug fixes, minor changes) — bumps `x.y.Z`
- **Minor** (new features, non-breaking) — bumps `x.Y.0`
- **Major** (breaking changes) — bumps `X.0.0`
- **No version bump** (redeploy current version)

#### 3b. Bump version (if not skipping)

If the user chose patch/minor/major:

1. Read `package.json` to get the current `version` field
2. Calculate the new version using semver increment
3. Edit `package.json` to update the `version` field

#### 3c. Collect changelog entries (if bumping version)

If a version bump was performed:

1. Use AskUserQuestion to ask the user what changed. Explain the available sections: **added**, **changed**, **fixed**, **removed**, **deprecated**, **security** (Keep a Changelog format)
2. Read `src/data/changelog.json`
3. Create a new entry at the **top** of the `releases` array with:
   - `version`: the new version
   - `date`: today's date (YYYY-MM-DD)
   - `sections`: object with only the sections that have entries (omit empty sections)

#### 3d. Run tests

```bash
npm test -- --run
```

**Abort deployment if tests fail.** Tell the user to fix test failures first.

#### 3e. Run lint

```bash
npm run lint
```

**Abort deployment if lint fails.** Tell the user to fix lint issues first.

#### 3f. Build

```bash
npm run build
```

This verifies TypeScript compiles and Vite injects the new version. **Abort deployment if build fails.**

#### 3g. Commit (if version was bumped)

If a version bump was performed in steps 3b-3c:

1. Stage `package.json` and `src/data/changelog.json`
2. Commit with message: `release: vX.Y.Z`

Do NOT push unless the user explicitly asks.

#### 3h. Deploy to Code Engine

**Important**: `ibmcloud` commands may trigger SSO login — run in foreground and warn the user they may need to interact with the browser.

```bash
# Target region
ibmcloud target -r us-south

# Select the frontend project (same project as profiles/pricing proxies)
ibmcloud ce project select --name vcf-migration

# Deploy from source (uses Dockerfile: npm ci → npm run build → nginx)
ibmcloud ce app update --name vcf-migration --build-source .
```

Wait for the build to complete, then:

```bash
# Get the deployment URL
ibmcloud ce app get --name vcf-migration --output url
```

#### 3i. Verify deployment

```bash
# Quick smoke test — check that the page loads
curl -s <url> | head -5
```

#### 3j. Summary

Print:
- New version (or "redeployed current version" if no bump)
- Deployment URL
- Whether commit was created (and remind user to push if desired)

### 4. Deploy profiles-proxy and/or pricing-proxy

These have automated deploy scripts. Run from the function directory:

```bash
cd functions/profiles-proxy && bash deploy.sh
# or
cd functions/pricing-proxy && bash deploy.sh
```

Both scripts handle:
- IBM Cloud login (SSO if needed — warn user they may need to interact with the browser)
- Target region (`us-south`) and resource group
- Code Engine project creation/selection (`vcf-migration`)
- Secret creation (`vcf-api-key`)
- App deployment: port 8080, min-scale 0, max-scale 3, CPU 0.25, memory 0.5G
- URL retrieval

**Important**: These scripts are interactive (SSO login). Run them with `Bash` and let the user see the output. Do NOT run in background.

**Note**: The pricing-proxy `deploy.sh` expects `IBM_CLOUD_RESOURCE_GROUP=vcf-migration-rg`. If not set, the script defaults to creating/using this resource group. Ensure `ibmcloud target -g vcf-migration-rg` is set before running.

### 5. Deploy ai-proxy (manual)

The ai-proxy has no deploy script. It uses literal env vars (not secrets).

**Important**: The ai-proxy's `IBM_CLOUD_API_KEY` is a **service ID API key**, not the user's personal key. Do NOT overwrite it with `$IBM_CLOUD_API_KEY` from your shell. Only set it on first-time deploy or when rotating the service ID key.

#### First-time deploy:

```bash
# Target the correct project (ai-proxy uses a separate CE project)
ibmcloud target -r us-south
ibmcloud ce project select --name vcf-migration-ai

# If project doesn't exist:
ibmcloud ce project create --name vcf-migration-ai

# Deploy — provide the service ID API key and watsonx project ID
ibmcloud ce app create --name vcf-ai-proxy \
  --build-source functions/ai-proxy \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 0 --max-scale 3 \
  --cpu 0.25 --memory 0.5G \
  --concurrency 100 \
  --env IBM_CLOUD_API_KEY="<service-id-api-key>" \
  --env WATSONX_PROJECT_ID="$WATSONX_PROJECT_ID" \
  --env ALLOWED_ORIGINS="https://vcf-migration.xxxx.us-south.codeengine.appdomain.cloud"

# Get the URL
ibmcloud ce app get --name vcf-ai-proxy --output url
```

#### Code-only update (no env var changes):

```bash
ibmcloud target -r us-south
ibmcloud ce project select --name vcf-migration-ai
ibmcloud ce app update --name vcf-ai-proxy --build-source functions/ai-proxy
```

#### Update env vars (e.g., change ALLOWED_ORIGINS):

```bash
ibmcloud ce app update --name vcf-ai-proxy \
  --env ALLOWED_ORIGINS="https://your-frontend-url"
```

### 6. Post-deployment

After each successful deployment:

1. **Extract the URL** from the deployment output
2. **Verify**:
   - **Proxies**: `curl -s https://<url>/health | jq .`
   - **Frontend**: `curl -s <url> | head -5` (already done in step 3i if frontend was deployed)
3. **Set/verify `ALLOWED_ORIGINS`** on all proxies (CORS security):

   All proxies restrict access via the `ALLOWED_ORIGINS` env var. After deploying the frontend (or if the frontend URL changes), update each proxy:

   ```bash
   # Get the frontend URL
   ibmcloud ce project select --name vcf-migration
   FRONTEND_URL=$(ibmcloud ce app get --name vcf-migration --output url)

   # Update ALLOWED_ORIGINS on profiles-proxy and pricing-proxy
   ibmcloud ce app update --name vcf-profiles-proxy --env ALLOWED_ORIGINS="$FRONTEND_URL"
   ibmcloud ce app update --name vcf-pricing-proxy --env ALLOWED_ORIGINS="$FRONTEND_URL"

   # Update ALLOWED_ORIGINS on ai-proxy (separate project)
   ibmcloud ce project select --name vcf-migration-ai
   ibmcloud ce app update --name vcf-ai-proxy --env ALLOWED_ORIGINS="$FRONTEND_URL"
   ```

   Multiple origins can be comma-separated: `ALLOWED_ORIGINS="https://prod-url,http://localhost:5173"`

4. **Remind user to update `.env`** (if proxy URLs changed):

```
VITE_PROFILES_PROXY_URL=https://<profiles-url>
VITE_PRICING_PROXY_URL=https://<pricing-url>
VITE_AI_PROXY_URL=https://<ai-url>
```

5. Tell the user to rebuild the app (`npm run build`) if proxy URLs changed — or redeploy the frontend if it was already deployed in this session.

## Error Handling

- If `deploy.sh` fails, read its output carefully — common issues are missing resource group or expired SSO session
- If Code Engine project doesn't exist, create it first
- If secret already exists, use `update` instead of `create` (and vice versa)
- If app already exists, use `update` instead of `create`
- If tests/lint/build fail during frontend deployment, **stop immediately** — do not commit or deploy broken code

## Important Notes

- Do NOT modify any deployment scripts or proxy source code
- Do NOT store API keys in files — they should only be in environment variables
- The deploy scripts are interactive due to SSO login — always run in foreground
- ai-proxy uses a **separate** Code Engine project (`vcf-migration-ai`), not the shared `vcf-migration` project
- Frontend and profiles/pricing proxies share the same CE project (`vcf-migration`)
- **Fail-fast**: Tests, lint, and build must all pass before committing or deploying the frontend
- **Version bump is optional**: User can redeploy without bumping (e.g., config-only change)
