#!/bin/bash

echo "========================================"
echo "FULL S3 DIAGNOSTIC TEST"
echo "========================================"
echo ""

cd /root/digital-storming-loadboard || { echo "Error: App directory not found"; exit 1; }

# Load environment variables
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    exit 1
fi

source .env

echo "📋 Step 1: Environment Variables Check"
echo "----------------------------------------"
echo "OBJECT_STORAGE_ENDPOINT: $OBJECT_STORAGE_ENDPOINT"
echo "OBJECT_STORAGE_BUCKET: $OBJECT_STORAGE_BUCKET"
echo "OBJECT_STORAGE_REGION: $OBJECT_STORAGE_REGION"
echo "ACCESS_KEY (first 10 chars): ${OBJECT_STORAGE_ACCESS_KEY:0:10}..."
echo "SECRET_KEY (first 10 chars): ${OBJECT_STORAGE_SECRET_KEY:0:10}..."
echo ""

# Check if keys are still placeholders
if [ "$OBJECT_STORAGE_ACCESS_KEY" = "your_key" ]; then
    echo "❌ ERROR: ACCESS_KEY is still 'your_key' - not updated!"
    exit 1
fi

if [ "$OBJECT_STORAGE_SECRET_KEY" = "your_secret" ]; then
    echo "❌ ERROR: SECRET_KEY is still 'your_secret' - not updated!"
    exit 1
fi

echo "✅ Keys appear to be updated"
echo ""

echo "🌐 Step 2: Network Connectivity Test"
echo "----------------------------------------"
curl -I https://$OBJECT_STORAGE_BUCKET.$OBJECT_STORAGE_REGION.digitaloceanspaces.com 2>&1 | head -5
echo ""

echo "📦 Step 3: AWS CLI Installation"
echo "----------------------------------------"
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    apt-get update > /dev/null 2>&1
    apt-get install -y awscli > /dev/null 2>&1
    echo "✅ AWS CLI installed"
else
    echo "✅ AWS CLI already installed"
fi
echo ""

echo "🔧 Step 4: Configure AWS CLI"
echo "----------------------------------------"
aws configure set aws_access_key_id "$OBJECT_STORAGE_ACCESS_KEY"
aws configure set aws_secret_access_key "$OBJECT_STORAGE_SECRET_KEY"
aws configure set default.region "$OBJECT_STORAGE_REGION"
echo "✅ AWS CLI configured"
echo ""

echo "📋 Step 5: List Bucket Contents"
echo "----------------------------------------"
echo "Testing: aws s3 ls s3://$OBJECT_STORAGE_BUCKET --endpoint-url $OBJECT_STORAGE_ENDPOINT"
aws s3 ls s3://$OBJECT_STORAGE_BUCKET --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "✅ Bucket listing successful!"
else
    echo "❌ Bucket listing failed with exit code: $RESULT"
    echo "This likely means credentials are incorrect or bucket doesn't exist"
fi
echo ""

echo "📤 Step 6: Test File Upload"
echo "----------------------------------------"
TEST_FILE="/tmp/s3-test-$(date +%s).txt"
echo "Test upload from $(hostname) at $(date)" > $TEST_FILE
echo "Uploading test file..."
aws s3 cp $TEST_FILE s3://$OBJECT_STORAGE_BUCKET/test-upload.txt --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1
UPLOAD_RESULT=$?
if [ $UPLOAD_RESULT -eq 0 ]; then
    echo "✅ Upload successful!"
else
    echo "❌ Upload failed with exit code: $UPLOAD_RESULT"
fi
echo ""

echo "🔍 Step 7: Verify Upload"
echo "----------------------------------------"
aws s3 ls s3://$OBJECT_STORAGE_BUCKET/ --endpoint-url $OBJECT_STORAGE_ENDPOINT 2>&1 | grep test-upload
VERIFY_RESULT=$?
if [ $VERIFY_RESULT -eq 0 ]; then
    echo "✅ File verified in bucket!"
else
    echo "❌ File not found in bucket"
fi
echo ""

echo "🧹 Step 8: Cleanup"
echo "----------------------------------------"
aws s3 rm s3://$OBJECT_STORAGE_BUCKET/test-upload.txt --endpoint-url $OBJECT_STORAGE_ENDPOINT > /dev/null 2>&1
rm -f $TEST_FILE
echo "✅ Cleanup complete"
echo ""

echo "🧪 Step 9: Node.js Test"
echo "----------------------------------------"
cat > /tmp/test-s3-node.js << 'NODESCRIPT'
require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  region: process.env.OBJECT_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
  },
  forcePathStyle: false,
});

async function test() {
  try {
    console.log('Testing S3 from Node.js...');
    const command = new PutObjectCommand({
      Bucket: process.env.OBJECT_STORAGE_BUCKET,
      Key: 'nodejs-test.txt',
      Body: Buffer.from('Node.js test'),
      ContentType: 'text/plain',
    });
    
    await client.send(command);
    console.log('✅ Node.js upload successful!');
    console.log('S3 connection is working from Node.js');
    process.exit(0);
  } catch (error) {
    console.error('❌ Node.js upload failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.Code || error.code);
    process.exit(1);
  }
}

test();
NODESCRIPT

node /tmp/test-s3-node.js
NODE_RESULT=$?
rm /tmp/test-s3-node.js
echo ""

echo "========================================"
echo "DIAGNOSTIC SUMMARY"
echo "========================================"
echo ""

if [ $UPLOAD_RESULT -eq 0 ] && [ $NODE_RESULT -eq 0 ]; then
    echo "🎉 SUCCESS! S3/Spaces is configured correctly!"
    echo ""
    echo "✅ Environment variables: OK"
    echo "✅ Network connectivity: OK"
    echo "✅ AWS CLI upload: OK"
    echo "✅ Node.js upload: OK"
    echo ""
    echo "The session capture should work now."
    echo "If it still fails, the issue is in the client app code."
else
    echo "❌ FAILURE! S3/Spaces is NOT working correctly."
    echo ""
    if [ $UPLOAD_RESULT -ne 0 ]; then
        echo "❌ AWS CLI upload failed"
    fi
    if [ $NODE_RESULT -ne 0 ]; then
        echo "❌ Node.js upload failed"
    fi
    echo ""
    echo "Common issues:"
    echo "1. Access Key or Secret Key are incorrect"
    echo "2. Bucket name is wrong"
    echo "3. Bucket doesn't exist"
    echo "4. Keys don't have permission to access this bucket"
    echo ""
    echo "Please verify your DigitalOcean Spaces configuration."
fi

echo ""
echo "Next steps:"
echo "1. If this test passed, restart your backend: pm2 restart digital-storming-loadboard"
echo "2. If this test failed, check your Spaces keys and bucket name"
echo "3. Check backend logs: pm2 logs digital-storming-loadboard"

