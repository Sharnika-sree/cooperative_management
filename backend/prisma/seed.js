const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // 1. Clear existing data
  await prisma.distribution.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.scheme.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.warehouseData.deleteMany({});
  await prisma.crop.deleteMany({});
  await prisma.farmer.deleteMany({});
  await prisma.chatbotConfig.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleared.');

  // 2. Hash Password helper
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 3. Create Users (Admin, Staff, Farmers)
  console.log('Seeding users...');
  
  // Admin
  await prisma.user.create({
    data: {
      name: 'Admin Manager',
      email: 'admin@coop.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Staff
  await prisma.user.create({
    data: {
      name: 'Priya',
      email: 'priya@coop.com',
      password: hashedPassword,
      role: 'STAFF',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Karthik',
      email: 'karthik@coop.com',
      password: hashedPassword,
      role: 'STAFF',
    },
  });

  // Farmers Users
  const raviUser = await prisma.user.create({
    data: {
      name: 'Ravi Kumar',
      email: 'ravi@coop.com',
      password: hashedPassword,
      role: 'FARMER',
    },
  });

  const lakshmiUser = await prisma.user.create({
    data: {
      name: 'Lakshmi',
      email: 'lakshmi@coop.com',
      password: hashedPassword,
      role: 'FARMER',
    },
  });

  const muthuUser = await prisma.user.create({
    data: {
      name: 'Muthu',
      email: 'muthu@coop.com',
      password: hashedPassword,
      role: 'FARMER',
    },
  });

  // 4. Create Farmers Profiles and Crops
  console.log('Seeding farmer profiles and crops...');
  
  const raviFarmer = await prisma.farmer.create({
    data: {
      userId: raviUser.id,
      membershipId: 'MEM001',
      name: 'Ravi Kumar',
      mobileNumber: '9876543210',
      village: 'Erode',
      landSize: 2.5,
      crop: 'Paddy, Turmeric', // Keep for fallback compatibility
      age: 42,
      gender: 'Male',
      address: '12, Main Street, Erode',
      district: 'Erode',
      landUnit: 'Acres',
      farmingType: 'Small Farmer',
      irrigationType: 'Borewell',
      crops: {
        create: [
          { name: 'Paddy' },
          { name: 'Turmeric' }
        ]
      }
    },
  });

  const lakshmiFarmer = await prisma.farmer.create({
    data: {
      userId: lakshmiUser.id,
      membershipId: 'MEM002',
      name: 'Lakshmi',
      mobileNumber: '9876543211',
      village: 'Perundurai',
      landSize: 1.5,
      crop: 'Turmeric, Vegetables', // Keep for fallback compatibility
      age: 38,
      gender: 'Female',
      address: '45, Temple Road, Perundurai',
      district: 'Erode',
      landUnit: 'Acres',
      farmingType: 'Small Farmer',
      irrigationType: 'Drip',
      crops: {
        create: [
          { name: 'Turmeric' },
          { name: 'Vegetables' }
        ]
      }
    },
  });

  const muthuFarmer = await prisma.farmer.create({
    data: {
      userId: muthuUser.id,
      membershipId: 'MEM003',
      name: 'Muthu',
      mobileNumber: '9876543212',
      village: 'Bhavani',
      landSize: 4.0,
      crop: 'Sugarcane, Paddy', // Keep for fallback compatibility
      age: 51,
      gender: 'Male',
      address: '8, River View Street, Bhavani',
      district: 'Erode',
      landUnit: 'Acres',
      farmingType: 'Medium Farmer',
      irrigationType: 'Canal',
      crops: {
        create: [
          { name: 'Sugarcane' },
          { name: 'Paddy' }
        ]
      }
    },
  });

  // 5. Create Inventory
  console.log('Seeding inventory items...');
  await prisma.inventory.create({
    data: {
      name: 'Urea',
      type: 'FERTILIZER',
      quantity: 250,
      unit: 'Bags',
      minStock: 20,
    },
  });

  await prisma.inventory.create({
    data: {
      name: 'DAP',
      type: 'FERTILIZER',
      quantity: 180,
      unit: 'Bags',
      minStock: 15,
    },
  });

  await prisma.inventory.create({
    data: {
      name: 'Paddy Seeds',
      type: 'SEED',
      quantity: 500,
      unit: 'Kg',
      minStock: 50,
    },
  });

  await prisma.inventory.create({
    data: {
      name: 'Turmeric Seeds',
      type: 'SEED',
      quantity: 200,
      unit: 'Kg',
      minStock: 20,
    },
  });

  // 6. Create Schemes
  console.log('Seeding government schemes...');
  await prisma.scheme.create({
    data: {
      title: 'PM-KISAN',
      description: 'Pradhan Mantri Kisan Samman Nidhi is an initiative by the Government of India that provides direct income support to all landholding farmer families across the country.',
      eligibilityRules: '{}', // Eligible for all registered farmers
      requiredDocuments: 'Aadhar Card, Land Ownership Proof, Bank Account Details',
      deadline: new Date('2026-12-31T23:59:59Z'),
      benefits: 'Direct financial benefit of ₹6,000 per year in three equal installments of ₹2,000.',
      isActive: true,
    },
  });

  await prisma.scheme.create({
    data: {
      title: 'PMFBY',
      description: 'Pradhan Mantri Fasal Bima Yojana (Crop Insurance) provides a comprehensive insurance cover against crop failure, helping in stabilizing the income of the farmers.',
      eligibilityRules: '{}', // Eligible for all registered farmers
      requiredDocuments: 'Aadhar Card, Land Record Copy, Bank Passbook Page',
      deadline: new Date('2026-09-30T23:59:59Z'),
      benefits: 'Low premium crop insurance covering yield loss due to non-preventable risks.',
      isActive: true,
    },
  });

  await prisma.scheme.create({
    data: {
      title: 'Drip Irrigation Subsidy',
      description: 'Subsidies for setting up modern micro-irrigation systems to improve crop productivity and water efficiency. Restricted to farmers owning less than 5 acres of land.',
      eligibilityRules: '{"maxLandSize": 5}', // Land size < 5 acres
      requiredDocuments: 'Aadhar Card, Chitta/Adangal Land Documents, Soil and Water Suitability Report',
      deadline: new Date('2026-10-15T23:59:59Z'),
      benefits: 'Up to 90% subsidy on the total cost of installing a drip irrigation system.',
      isActive: true,
    },
  });

  // 7. Create Announcements
  console.log('Seeding announcements...');
  await prisma.announcement.create({
    data: {
      title: 'Fertilizer stock has arrived.',
      content: 'Fresh stock of Urea and DAP has arrived at the cooperative society. Farmers can check availability and contact staff for fertilizer distribution.',
      createdAt: new Date(),
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'Cooperative meeting on 15 August.',
      content: 'All cooperative society members are invited to attend our general body meeting on August 15th at the main assembly room.',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  });

  // 8. Create Warehouse Sensor Data
  console.log('Seeding warehouse data...');
  await prisma.warehouseData.create({
    data: {
      temperature: 29.0,
      humidity: 68.0,
      timestamp: new Date(),
    },
  });

  // 9. Seed ChatbotConfig default
  console.log('Seeding default chatbot config...');
  await prisma.chatbotConfig.create({
    data: {
      prompt: 'You are a helpful assistant for a Cooperative Society Management System. Use the following context to answer the user\'s question accurately.',
      knowledge: 'This cooperative society provides seeds, fertilizers, and pesticide services. We support PM-KISAN, PMFBY, and Drip Irrigation Subsidy schemes.',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
