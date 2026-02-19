// Prisma 客户端 - 支持 Turso 云数据库
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// 创建 Prisma 客户端
const prismaClientSingleton = () => {
  // 检查是否使用 Turso 云数据库
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    // 云端模式：使用 Turso
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // @ts-expect-error - Prisma adapter type mismatch
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter });
  } else {
    // 本地模式：使用 SQLite
    return new PrismaClient();
  }
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
