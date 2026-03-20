import * as usersModel from '../models/users.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@priceradar.local';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const existing = await usersModel.findUserByEmail(email);
  if (existing) {
    console.log('Admin user already exists:', email);
    process.exit(0);
    return;
  }
  await usersModel.createUser(email, password, 'super_admin');
  console.log('Created super_admin user:', email);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
