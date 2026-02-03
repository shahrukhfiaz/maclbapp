#!/bin/bash

echo "========================================="
echo "Testing S3/Spaces Connection"
echo "========================================="
echo ""

cd /root/digital-storming-loadboard

# Load environment variables
source .env 2>/dev/null || { echo "Error: .env file not found"; exit 1; }

echo "📋 Current Configuration:"
echo "  Endpoint: $OBJECT_STORAGE_ENDPOINT"
echo "  Bucket: $OBJECT_STORAGE_BUCKET"
echo "  Region: $OBJECT_STORAGE_REGION"
echo "  Access Key: ${OBJECT_STORAGE_ACCESS_KEY:0:10}..."
echo "  Secret Key: ${OBJECT_STORAGE_SECRET_KEY:0:10}..."
echo ""

echo "🌐 Test 1: Endpoint Connectivity"
curl -I https://$OBJECT_STORAGE_BUCKET.${OBJECT_STORAGE_REGION}.digitaloceanspaces.com 2>&1 | head -3
echo ""

echo "📦 Test 2: List Bucket (using AWS CLI)"
if ! command -v aws &> /dev/null; then
    echo "AWS CLI not installed. Installing..."
    apt-get update > /dev/null 2>&1
    apt-get install -y awscli > /dev/null 2>&1
fi

# Configure AWS CLI
aws configure set aws_access_key_id $OBJECT_STORAGE_ACCESS_KEY
aws configure set aws_secret_access_key $OBJECT_STORAGE_SECRET_KEY
aws configure set default.region $OBJECT_STORAGE_REGION

# Test listing
aws s3 ls s3://$OBJECT_STORAGE_BUCKET --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1
echo ""

echo "📤 Test 3: Upload Test File"
echo "Test upload from $(date)" > /tmp/test-upload.txt
aws s3 cp /tmp/test-upload.txt s3://$OBJECT_STORAGE_BUCKET/test-upload.txt --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1
echo ""

echo "🔍 Test 4: Verify Upload"
aws s3 ls s3://$OBJECT_STORAGE_BUCKET/ --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1 | grep test-upload
echo ""

echo "🧹 Test 5: Cleanup"
aws s3 rm s3://$OBJECT_STORAGE_BUCKET/test-upload.txt --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1
rm /tmp/test-upload.txt
echo ""

echo "========================================="
echo "✅ All tests completed!"
echo "========================================="
echo ""
echo "If you see 'Access Denied' errors above, your credentials are incorrect."
echo "If all tests passed, S3 connection is working correctly."

