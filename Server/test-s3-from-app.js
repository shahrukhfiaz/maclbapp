// Test S3 connection from within the app (has all dependencies)
require('dotenv').config();
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  region: process.env.OBJECT_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
  },
  forcePathStyle: false,
});

const bucket = process.env.OBJECT_STORAGE_BUCKET;

async function testS3Connection() {
  console.log('========================================');
  console.log('Testing S3 Connection from Node.js App');
  console.log('========================================\n');

  console.log('📋 Configuration:');
  console.log(`  Endpoint: ${process.env.OBJECT_STORAGE_ENDPOINT}`);
  console.log(`  Bucket: ${bucket}`);
  console.log(`  Region: ${process.env.OBJECT_STORAGE_REGION}`);
  console.log(`  Access Key: ${process.env.OBJECT_STORAGE_ACCESS_KEY?.substring(0, 10)}...`);
  console.log(`  Secret Key: ${process.env.OBJECT_STORAGE_SECRET_KEY?.substring(0, 10)}...\n`);

  try {
    // Test 1: List bucket contents
    console.log('📋 Test 1: List Bucket Contents');
    console.log('----------------------------------------');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 10,
    });
    
    const listResult = await client.send(listCommand);
    console.log(`✅ Bucket listing successful!`);
    console.log(`   Objects found: ${listResult.Contents?.length || 0}`);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log('   Latest files:');
      listResult.Contents.slice(0, 5).forEach(obj => {
        console.log(`   - ${obj.Key} (${obj.Size} bytes)`);
      });
    } else {
      console.log('   Bucket is empty (no files yet)');
    }
    console.log('');

    // Test 2: Upload a test file
    console.log('📤 Test 2: Upload Test File');
    console.log('----------------------------------------');
    const testData = Buffer.from(`Test from Node.js at ${new Date().toISOString()}`);
    const testKey = `test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testData,
      ContentType: 'text/plain',
    });
    
    await client.send(uploadCommand);
    console.log(`✅ File uploaded successfully: ${testKey}`);
    console.log(`   Size: ${testData.length} bytes\n`);

    // Test 3: Generate presigned URL (like the app does)
    console.log('🔗 Test 3: Generate Presigned URL');
    console.log('----------------------------------------');
    const presignCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: `sessions/test-presigned-${Date.now()}.zip`,
      ContentType: 'application/zip',
    });
    
    const presignedUrl = await getSignedUrl(client, presignCommand, { expiresIn: 3600 });
    console.log(`✅ Presigned URL generated successfully!`);
    console.log(`   URL length: ${presignedUrl.length} characters`);
    console.log(`   URL starts with: ${presignedUrl.substring(0, 50)}...\n`);

    // Test 4: Upload using presigned URL (exactly like the client app does)
    console.log('📤 Test 4: Upload via Presigned URL');
    console.log('----------------------------------------');
    const axios = require('axios');
    const testZipData = Buffer.from('Test session bundle data');
    
    await axios.put(presignedUrl, testZipData, {
      headers: { 'Content-Type': 'application/zip' },
    });
    console.log(`✅ Upload via presigned URL successful!\n`);

    // Summary
    console.log('========================================');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('========================================\n');
    console.log('✅ Bucket listing: OK');
    console.log('✅ Direct upload: OK');
    console.log('✅ Presigned URL generation: OK');
    console.log('✅ Presigned URL upload: OK\n');
    console.log('S3/Spaces connection is working perfectly!');
    console.log('The session upload from client app should work.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('Error code:', error.Code || error.code);
    console.error('Error name:', error.name);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.error('\nFull error:', error);
    
    console.log('\n📋 Troubleshooting:');
    console.log('1. Verify Access Key and Secret Key are correct');
    console.log('2. Check bucket name: ' + bucket);
    console.log('3. Verify keys have permissions for this bucket');
    console.log('4. Check network connectivity to Spaces endpoint\n');
    
    process.exit(1);
  }
}

testS3Connection();

