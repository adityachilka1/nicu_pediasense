#!/usr/bin/env node
/**
 * Generate a cryptographically secure secret for NextAuth
 *
 * Usage: node scripts/generate-secret.js
 *
 * The generated secret should be placed in your .env.local file:
 *   NEXTAUTH_SECRET=<generated_secret>
 */

import crypto from 'crypto';

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

const secret = generateSecret();

console.log('\n===========================================');
console.log('  NICU Dashboard - Secret Generator');
console.log('===========================================\n');
console.log('Generated secure secret for NEXTAUTH_SECRET:\n');
console.log(`  ${secret}\n`);
console.log('-------------------------------------------');
console.log('Add this to your .env.local file:\n');
console.log(`  NEXTAUTH_SECRET=${secret}\n`);
console.log('-------------------------------------------');
console.log('IMPORTANT:');
console.log('  - Never commit this secret to version control');
console.log('  - Use different secrets for each environment');
console.log('  - Rotate secrets periodically for security');
console.log('===========================================\n');
