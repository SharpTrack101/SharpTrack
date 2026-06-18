const { PrismaClient } = require('@prisma/client');

// Singleton pattern: reuse the same PrismaClient instance across
// all requests to avoid exhausting the database connection pool.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;
