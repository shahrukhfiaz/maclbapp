#!/bin/bash

echo "========================================="
echo "Checking Session Bundle in Spaces"
echo "========================================="
echo ""

cd /root/digital-storming-loadboard

# Load environment variables
source .env

# Configure AWS CLI
aws configure set aws_access_key_id "$OBJECT_STORAGE_ACCESS_KEY"
aws configure set aws_secret_access_key "$OBJECT_STORAGE_SECRET_KEY"
aws configure set default.region "$OBJECT_STORAGE_REGION"

echo "📦 Listing session bundles in Spaces:"
echo "----------------------------------------"
aws s3 ls s3://$OBJECT_STORAGE_BUCKET/sessions/ --recursive --endpoint-url $OBJECT_STORAGE_ENDPOINT --human-readable --summarize

echo ""
echo "🔍 Checking database for session bundle key:"
echo "----------------------------------------"
echo "SELECT id, name, status, \"bundleKey\", \"bundleVersion\", \"lastLoginAt\" FROM \"DatSession\" WHERE name = 'Shared DAT Session';" | psql "$DATABASE_URL"

echo ""
echo "========================================="
echo "If you see a .zip file above with size > 50KB, the session was saved."
echo "If bundleKey is NOT NULL in database, the upload completed successfully."
echo "========================================="

