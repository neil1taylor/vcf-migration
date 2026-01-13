# Create a Service ID

## High-level approach

You **do not grant permissions to the API key directly**. Instead, you:

1. Create a **Service ID**
2. Assign that Service ID **read-only access to the Global Catalog**
3. Create an **API key bound to that Service ID**
4. Use that API key with the CLI or directly against the Global Catalog API

## What permissions are actually required?

For **pricing info from the Global Catalog API only**, you need:

* **Service:** `globalcatalog`
* **Role:** `Reader`
* **Scope:** Account-level

You do **not** need:

* Resource group access
* Billing Viewer
* Account Administrator
* Any VPC or service access

Pricing metadata lives in the **Global Catalog**, not the Billing APIs.

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

Grant **Reader** on **Global Catalog** only:

```bash
ibmcloud iam service-policy-create pricing-reader \
  --service-name globalcatalog \
  --roles Reader
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

## 6. Using it directly with the Global Catalog API

### Get an IAM access token

```bash
curl -X POST "https://iam.cloud.ibm.com/identity/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=API_KEY"
```

Extract `access_token`.

---

### Call the Global Catalog API

Example: list services with pricing metadata

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://globalcatalog.cloud.ibm.com/api/v1?include=pricing"
```

You should get catalog data **without permission errors**.