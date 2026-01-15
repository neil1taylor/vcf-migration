# Create a Service ID

## High-level approach

You **do not grant permissions to the API key directly**. Instead, you:

1. Create a **Service ID**
2. Assign that Service ID **read-only access to the Global Catalog**
3. Create an **API key bound to that Service ID**
4. Use that API key with the CLI or directly against the Global Catalog API

## What permissions are actually required?

### For Pricing (Global Catalog API)

* **Service:** `globalcatalog`
* **Role:** `Reader`
* **Scope:** Account-level

### For Live Profiles (VPC API)

* **Service:** `is.instance` (VPC Infrastructure Services)
* **Role:** `Viewer`
* **Scope:** Account-level or specific region

### For ROKS Machine Types (Kubernetes Service API)

* **Service:** `containers-kubernetes` (Kubernetes Service)
* **Role:** `Viewer`
* **Scope:** Account-level

Pricing metadata lives in the **Global Catalog**. Instance profiles come from the **VPC API**.

## Step-by-step (CLI only)

### 1. Log in to IBM Cloud

```bash
ibmcloud login
```

If this is for automation, you can do this once interactively.

---

### 2. Create a Service ID

```bash
ibmcloud iam service-id-create pricing-reader \
  --description "Read-only access to Global Catalog pricing"
```

Verify it exists:

```bash
ibmcloud iam service-ids
```

---

### 3. Assign *minimum* required access

Grant **Reader** on **Global Catalog** (for pricing):

```bash
ibmcloud iam service-policy-create pricing-reader \
  --service-name globalcatalog \
  --roles Reader
```

Grant **Viewer** on **VPC Infrastructure Services** (for live profiles):

```bash
ibmcloud iam service-policy-create pricing-reader \
  --service-name is \
  --roles Viewer
```

(Optional) Grant **Viewer** on **Kubernetes Service** (for ROKS machine types):

```bash
ibmcloud iam service-policy-create pricing-reader \
  --service-name containers-kubernetes \
  --roles Viewer
```

### 4. Create the API key for the Service ID

```bash
ibmcloud iam service-api-key-create pricing-key pricing-reader \
  --description "API key for Global Catalog pricing access"
```

⚠️ **Copy the key immediately** — it will not be shown again.

Example output:

```text
API Key          xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 5. Test access (CLI)

Log in using the Service ID API key:

```bash
ibmcloud login --apikey xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Now test catalog access:

```bash
ibmcloud catalog service
```

Or a specific service:

```bash
ibmcloud catalog service ibm-cloud-object-storage
```

If this works and **other services fail**, you’ve nailed least privilege.

## 6. Using APIs directly

### Get an IAM access token

```bash
curl -X POST "https://iam.cloud.ibm.com/identity/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=API_KEY"
```

Extract `access_token`.

---

### Call the Global Catalog API (Pricing)

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://globalcatalog.cloud.ibm.com/api/v1?include=pricing"
```

---

### Call the VPC API (VSI Profiles)

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://us-south.iaas.cloud.ibm.com/v1/instance/profiles?version=2024-11-12&generation=2"
```

---

### Call the VPC API (Bare Metal Profiles)

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://us-south.iaas.cloud.ibm.com/v1/bare_metal_server/profiles?version=2024-11-12&generation=2"
```

---

### Call the ROKS API (Flavors)

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://containers.cloud.ibm.com/global/v2/getFlavors?zone=us-south-1&provider=vpc-gen2"
```

## 7. Available ROKS Bare Metal Profiles

Only the following bare metal profiles are supported for ROKS worker nodes:

| Profile | Cores | Memory | NVMe Storage |
|---------|-------|--------|--------------|
| bx2.metal.96x384 | 48 | 384 GB | None |
| bx2d.metal.96x384 | 48 | 384 GB | 8×3200 GB |
| cx2.metal.96x192 | 48 | 192 GB | None |
| cx2d.metal.96x192 | 48 | 192 GB | 8×3200 GB |
| mx2.metal.96x768 | 48 | 768 GB | None |
| mx2d.metal.96x768 | 48 | 768 GB | 8×3200 GB |

The `d` suffix indicates NVMe local storage, required for ODF (OpenShift Data Foundation).