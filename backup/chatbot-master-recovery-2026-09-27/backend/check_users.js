const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying database users...');
  const users = await prisma.user.findMany();
  console.log('Found users:');
  users.forEach(u => {
    console.log(`- Email: ${u.email}, Role: ${u.role}, Name: ${u.name}, PasswordHash: ${u.password.substring(0, 10)}...`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
