// Bootstrap Super Admin User
// Run this if super admin doesn't exist in the database

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'superadmin@digitalstorming.com';
const SUPER_ADMIN_PASSWORD = 'ChangeMeSuperSecure123!';

async function bootstrap() {
  try {
    console.log('🔍 Checking for existing super admin...');
    
    const existing = await prisma.user.findFirst({ 
      where: { role: 'SUPER_ADMIN' } 
    });
    
    if (existing) {
      console.log('✅ Super Admin already exists:');
      console.log('   Email:', existing.email);
      console.log('   Status:', existing.status);
      console.log('   Created:', existing.createdAt);
      return;
    }
    
    console.log('❌ No Super Admin found. Creating...');
    console.log('');
    
    // Hash password
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    
    // Create super admin
    const superAdmin = await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    
    console.log('✅ Super Admin created successfully!');
    console.log('');
    console.log('📋 Credentials:');
    console.log('   Email:', SUPER_ADMIN_EMAIL);
    console.log('   Password:', SUPER_ADMIN_PASSWORD);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    
  } catch (error) {
    console.error('❌ Failed to bootstrap super admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap();

