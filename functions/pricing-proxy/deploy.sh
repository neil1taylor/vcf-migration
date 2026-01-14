#!/bin/bash
set -e

# VCF Migration Pricing Proxy - Deployment Script
# Deploys the pricing proxy function to IBM Cloud Functions

echo "=== VCF Pricing Proxy Deployment ==="
echo ""

# Configuration
FUNCTION_NAME="vcf-pricing-proxy"
PACKAGE_NAME="vcf-migration"
NAMESPACE="${IBM_CLOUD_NAMESPACE:-default}"
REGION="${IBM_CLOUD_REGION:-us-south}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    if ! command -v ibmcloud &> /dev/null; then
        echo -e "${RED}Error: IBM Cloud CLI not found${NC}"
        echo "Install from: https://cloud.ibm.com/docs/cli"
        exit 1
    fi

    # Check if logged in
    if ! ibmcloud account show &> /dev/null; then
        echo -e "${YELLOW}Not logged in to IBM Cloud${NC}"
        echo "Running: ibmcloud login --sso"
        ibmcloud login --sso
    fi

    # Check Functions plugin
    if ! ibmcloud fn namespace list &> /dev/null; then
        echo "Installing Cloud Functions plugin..."
        ibmcloud plugin install cloud-functions
    fi

    echo -e "${GREEN}Prerequisites OK${NC}"
}

# Set up namespace
setup_namespace() {
    echo ""
    echo "Setting up Functions namespace..."

    # Check if namespace exists
    if ! ibmcloud fn namespace get "$NAMESPACE" &> /dev/null; then
        echo "Creating namespace: $NAMESPACE"
        ibmcloud fn namespace create "$NAMESPACE" --description "VCF Migration functions"
    fi

    # Target the namespace
    ibmcloud fn namespace target "$NAMESPACE"

    echo -e "${GREEN}Namespace ready: $NAMESPACE${NC}"
}

# Create the action (function)
deploy_function() {
    echo ""
    echo "Deploying function..."

    # Check if API key parameter should be bound
    if [ -n "$IBM_CLOUD_API_KEY" ]; then
        echo "Binding API key parameter..."
        API_KEY_PARAM="--param IBM_CLOUD_API_KEY $IBM_CLOUD_API_KEY"
    else
        echo -e "${YELLOW}Warning: IBM_CLOUD_API_KEY not set. Function will return default pricing.${NC}"
        API_KEY_PARAM=""
    fi

    # Create or update the action
    ibmcloud fn action update "$FUNCTION_NAME" index.js \
        --kind nodejs:18 \
        --web true \
        --web-secure false \
        --timeout 30000 \
        --memory 256 \
        $API_KEY_PARAM

    echo -e "${GREEN}Function deployed: $FUNCTION_NAME${NC}"
}

# Get the function URL
get_function_url() {
    echo ""
    echo "Getting function URL..."

    # Get the API host
    API_HOST=$(ibmcloud fn property get --apihost | awk '{print $4}')

    # Get namespace ID
    NAMESPACE_ID=$(ibmcloud fn namespace get "$NAMESPACE" --output json | jq -r '.id')

    # Construct URL
    FUNCTION_URL="https://${API_HOST}/api/v1/web/${NAMESPACE_ID}/default/${FUNCTION_NAME}"

    echo ""
    echo "=========================================="
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo "=========================================="
    echo ""
    echo "Function URL:"
    echo -e "${GREEN}${FUNCTION_URL}${NC}"
    echo ""
    echo "Test the function:"
    echo "  curl '${FUNCTION_URL}'"
    echo ""
    echo "Add to your .env file:"
    echo "  VITE_PRICING_PROXY_URL=${FUNCTION_URL}"
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    setup_namespace
    deploy_function
    get_function_url
}

# Run main
main
