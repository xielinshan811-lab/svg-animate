// Prisma 客户端 - 支持 Turso 云数据库
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// 延迟创建 Prisma 客户端（避免构建时错误）
let prismaInstance: PrismaClient | null = null;

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!prismaInstance) {
      // 检查是否使用 Turso 云数据库
      if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
        const libsql = createClient({
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        // @ts-expect-error - Prisma adapter type mismatch
        const adapter = new PrismaLibSql(libsql);
        prismaInstance = new PrismaClient({ adapter });
      } else {
        // @ts-expect-error - 本地开发时使用默认配置
        prismaInstance = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } });
      }
    }
    return (prismaInstance as unknown as Record<string, unknown>)[prop as string];
  }
});
