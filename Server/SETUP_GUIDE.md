# Digital Storming Loadboard - Environment Setup Guide

## 🔧 Quick Setup Steps

### 1. Create Your Environment File
Create a `.env` file in the project root with these variables:

```env
# Basic Configuration
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://username:password@localhost:5432/mydb

# JWT Secrets (generate with the command below)
JWT_ACCESS_SECRET=your-64-character-hex-string
JWT_REFRESH_SECRET=your-64-character-hex-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Hashing
BCRYPT_SALT_ROUNDS=12

# Object Storage (choose one option below)
OBJECT_STORAGE_ENDPOINT=https://s3.amazonaws.com
OBJECT_STORAGE_BUCKET=your-bucket-name
OBJECT_STORAGE_ACCESS_KEY=your-access-key
OBJECT_STORAGE_SECRET_KEY=your-secret-key
OBJECT_STORAGE_REGION=us-east-1

# Session Seeder Configuration
# API_BASE_URL should point to your REST API prefix - this is what the seeder hits for all requests
API_BASE_URL=http://localhost:4000/api/v1  # For development
# API_BASE_URL=https://api.yourdomain.com/api/v1  # For production
SEEDER_API_TOKEN=your-jwt-token  # Must be issued by your backend
DAT_MASTER_USERNAME=your-dat-username
DAT_MASTER_PASSWORD=your-dat-password
SESSION_BUNDLE_ENCRYPTION_KEY=your-base64-key
```

### 2. Generate Required Keys

#### JWT Secrets (64 characters each):
```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

#### Encryption Key (32-byte base64):
```bash
node -e "console.log('SESSION_BUNDLE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

#### Seeder API Token:
You'll need to create this programmatically or through your API's authentication system. **Important:** This JWT token must be issued by your backend (log in as a service user or mint one via an admin endpoint). Remember to refresh/rotate it periodically for security.

### 3. Object Storage Setup Options

#### Option A: AWS S3 (Most Popular)
1. Go to [AWS Console](https://console.aws.amazon.com)
2. Create an IAM user with S3 permissions
3. Generate access keys
4. Create an S3 bucket
5. Use these values:
   ```env
   OBJECT_STORAGE_ENDPOINT=https://s3.amazonaws.com
   OBJECT_STORAGE_REGION=us-east-1
   ```

#### Option B: DigitalOcean Spaces (Cheaper Alternative)
1. Go to [DigitalOcean Spaces](https://cloud.digitalocean.com/spaces)
2. Create a new Space
3. Generate API keys in Settings → API
4. Use these values (replace `<region>` with your actual region like `nyc3`, `sfo3`, etc.):
   ```env
   OBJECT_STORAGE_ENDPOINT=https://<region>.digitaloceanspaces.com
   OBJECT_STORAGE_REGION=<region>
   ```

#### Option C: Local MinIO (For Development)
1. Install MinIO locally
2. Use these values:
   ```env
   OBJECT_STORAGE_ENDPOINT=http://localhost:9000
   OBJECT_STORAGE_REGION=us-east-1
   ```

### 4. DAT.com Credentials
These are your actual DAT.com login credentials that the seeder will use to log in and create session profiles.

**⚠️ SECURITY WARNING:** Keep these credentials secure! In production, use a secrets management service (AWS Secrets Manager, Azure Key Vault, etc.) rather than storing them in flat files.

### 5. Database Setup
You need a PostgreSQL database. Options:
- Local PostgreSQL installation
- Docker: `docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`
- Cloud providers: AWS RDS, DigitalOcean Managed Databases, etc.

## 🚀 Quick Start Commands

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Install Playwright (for seeder):**
   ```bash
   npx playwright install chromium
   ```
   **Note:** This command should be run on the seeder machine where you'll execute the worker.

5. **Run the seeder worker:**
   ```bash
   ts-node src/jobs/sessionSeeder.worker.ts <sessionId>
   ```

## ⚠️ Important Notes

- **Build Requirements:** `npm run build` (or `npm run dev`) will fail if required environment variables are missing. Make sure your `.env` file is properly configured before building.
- **Security:** The encryption key and DAT credentials should be kept in secrets management in production, not in flat files.
- **Token Rotation:** Remember to periodically refresh your `SEEDER_API_TOKEN` for security.

## 📝 Notes

- The `.env` file should never be committed to version control
- For production, use environment variables or a secrets management service
- Make sure your object storage bucket allows the necessary permissions
- The seeder worker requires a valid session ID from your database
