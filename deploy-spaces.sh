#!/bin/bash

# Kuratchi Spaces Deployment Helper
# This script helps you set environment variables and deploy

echo "🚀 Kuratchi Spaces Deployment Helper"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "✅ Found .env file, loading variables..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No .env file found"
    echo ""
    echo "Please set the following environment variables:"
    echo ""
    
    # Check and prompt for CLOUDFLARE_ACCOUNT_ID
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        echo "CLOUDFLARE_ACCOUNT_ID is not set"
        read -p "Enter your Cloudflare Account ID: " CLOUDFLARE_ACCOUNT_ID
        export CLOUDFLARE_ACCOUNT_ID
    fi
    
    # Check and prompt for CLOUDFLARE_API_TOKEN
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        echo "CLOUDFLARE_API_TOKEN is not set"
        read -sp "Enter your Cloudflare API Token: " CLOUDFLARE_API_TOKEN
        echo ""
        export CLOUDFLARE_API_TOKEN
    fi
    
    # Check and prompt for KURATCHI_GATEWAY_KEY
    if [ -z "$KURATCHI_GATEWAY_KEY" ]; then
        echo "KURATCHI_GATEWAY_KEY is not set"
        read -sp "Enter your Kuratchi Gateway Key (or press Enter to generate one): " KURATCHI_GATEWAY_KEY
        echo ""
        
        if [ -z "$KURATCHI_GATEWAY_KEY" ]; then
            echo "Generating a new gateway key..."
            KURATCHI_GATEWAY_KEY="kuratchi_gk_$(openssl rand -hex 32)"
            echo "Generated: $KURATCHI_GATEWAY_KEY"
            echo "⚠️  SAVE THIS KEY - You'll need it for your apps!"
        fi
        
        export KURATCHI_GATEWAY_KEY
    fi
    
    echo ""
    echo "💾 Save these to .env file? (y/n)"
    read -p "> " save_env
    
    if [ "$save_env" = "y" ] || [ "$save_env" = "Y" ]; then
        cat > .env << EOF
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN

# Kuratchi Configuration
KURATCHI_GATEWAY_KEY=$KURATCHI_GATEWAY_KEY
EOF
        echo "✅ Saved to .env file"
        echo "⚠️  Don't forget to add .env to .gitignore!"
    fi
fi

echo ""
echo "📋 Configuration:"
echo "   Account ID: ${CLOUDFLARE_ACCOUNT_ID:0:8}..."
echo "   API Token: ${CLOUDFLARE_API_TOKEN:0:8}..."
echo "   Gateway Key: ${KURATCHI_GATEWAY_KEY:0:16}..."
echo ""

# Run deployment
echo "🚀 Starting deployment..."
echo ""
pnpm deploy:spaces

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✨ Next steps:"
    echo "   1. Copy the Worker URL from above"
    echo "   2. Add to your app's .env file:"
    echo "      KURATCHI_SPACES_WORKER_URL=<worker-url>"
    echo "      KURATCHI_GATEWAY_KEY=$KURATCHI_GATEWAY_KEY"
else
    echo ""
    echo "❌ Deployment failed. Check the errors above."
    exit $EXIT_CODE
fi
