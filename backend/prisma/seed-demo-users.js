const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Demo user credentials as specified by user
const DEMO_USERS = [
  {
    email: 'admin@smartcoop.in',
    password: 'Admin@123',
    name: 'Cooperative Administrator',
    role: 'ADMIN',
    farmerProfile: null
  },
  {
    email: 'staff@smartcoop.in',
    password: 'Staff@123',
    name: 'Ravi Kumar',
    role: 'STAFF',
    farmerProfile: null
  },
  {
    email: 'selvam@smartcoop.in',
    password: 'Farmer@123',
    name: 'M. Selvam',
    role: 'FARMER',
    farmerProfile: {
      membershipId: 'FARM001',
      mobileNumber: '9876543210',
      village: 'Salem',
      landSize: 2.5,
      crop: 'Groundnut',
      age: 35,
      gender: 'Male',
      address: '123, Main Street, Salem',
      district: 'Salem',
      landUnit: 'Acres',
      farmingType: 'Small Farmer',
      irrigationType: 'Borewell'
    }
  },
  {
    email: 'lakshmi@smartcoop.in',
    password: 'Farmer@123',
    name: 'K. Lakshmi',
    role: 'FARMER',
    farmerProfile: {
      membershipId: 'FARM002',
      mobileNumber: '9876543211',
      village: 'Coimbatore',
      landSize: 4.0,
      crop: 'Rice',
      age: 42,
      gender: 'Female',
      address: '45, Temple Road, Coimbatore',
      district: 'Coimbatore',
      landUnit: 'Acres',
      farmingType: 'Medium Farmer',
      irrigationType: 'Canal'
    }
  }
];

async function main() {
  console.log('Starting idempotent demo user seed...');

  for (const demoUser of DEMO_USERS) {
    const existingUser = await prisma.user.findUnique({
      where: { email: demoUser.email }
    });

    const hashedPassword = await bcrypt.hash(demoUser.password, 10);

    if (existingUser) {
      // Check if password needs updating
      const passwordMatch = await bcrypt.compare(demoUser.password, existingUser.password);
      
      if (!passwordMatch) {
        console.log(`Updating password for existing user: ${demoUser.email} (${demoUser.role})`);
        await prisma.user.update({
          where: { email: demoUser.email },
          data: { 
            password: hashedPassword,
            name: demoUser.name,
            role: demoUser.role
          }
        });
        console.log(`  ✓ Updated user: ${demoUser.email}`);
      } else {
        console.log(`✓ User already exists with correct password: ${demoUser.email} (${demoUser.role}) - skipping`);
      }
      
      // Ensure farmer profile exists for FARMER roles
      if (demoUser.role === 'FARMER' && demoUser.farmerProfile) {
        const existingFarmer = await prisma.farmer.findUnique({
          where: { userId: existingUser.id }
        });

        if (!existingFarmer) {
          await prisma.farmer.create({
            data: {
              userId: existingUser.id,
              name: demoUser.name,
              ...demoUser.farmerProfile
            }
          });
          console.log(`  ✓ Created farmer profile for ${demoUser.email}`);
        }
      }
      continue;
    }

    console.log(`Creating user: ${demoUser.email} (${demoUser.role})`);

    const userData = {
      email: demoUser.email,
      password: hashedPassword,
      name: demoUser.name,
      role: demoUser.role
    };

    const user = await prisma.user.create({
      data: userData
    });

    console.log(`  ✓ Created user: ${demoUser.email}`);

    // Create farmer profile if applicable
    if (demoUser.role === 'FARMER' && demoUser.farmerProfile) {
      const existingFarmer = await prisma.farmer.findUnique({
        where: { userId: user.id }
      });

      if (existingFarmer) {
        console.log(`  ✓ Farmer profile already exists for ${demoUser.email} - skipping`);
      } else {
        await prisma.farmer.create({
          data: {
            userId: user.id,
            name: demoUser.name,
            ...demoUser.farmerProfile
          }
        });
        console.log(`  ✓ Created farmer profile for ${demoUser.email}`);
      }
    }
  }

  console.log('Demo user seed completed successfully!');
  console.log('\nDemo Credentials:');
  console.log('==================');
  DEMO_USERS.forEach(u => {
    console.log(`${u.role}: ${u.email} / ${u.password}`);
  });
}

main()
  .catch((e) => {
    console.error('Error during demo user seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
