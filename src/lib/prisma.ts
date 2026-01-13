// Prisma Client for RisuAI Service Web
// Based on Prisma 7+ and SvelteKit integration guide

import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Get DATABASE_URL from environment
// In SvelteKit, use $env/static/private, but for Node.js scripts use process.env
const getDatabaseUrl = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.DATABASE_URL
  }
  // For browser/SvelteKit, this should be handled differently
  throw new Error('DATABASE_URL is not available in this environment')
}

// Create PostgreSQL adapter
const connectionString = getDatabaseUrl()
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create adapter with connection string (Prisma 7+)
const adapter = new PrismaPg({
  connectionString,
})

// Create Prisma Client instance
// In production, consider using a connection pooler like Prisma Accelerate
const prisma = new PrismaClient({
  adapter,
})

// Handle graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

export default prisma
