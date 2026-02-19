// 充值 API（模拟充值）
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

// 充值套餐
const PACKAGES = {
  basic: { credits: 10, price: 9.9 },
  standard: { credits: 50, price: 39.9 },
  premium: { credits: 200, price: 99.9 },
};

export async function POST(request: Request) {
  try {
    const { packageId } = await request.json();

    // 验证登录
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: '请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.userId as string;

    // 验证套餐
    const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
    if (!pkg) {
      return new Response(
        JSON.stringify({ error: '无效的充值套餐' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 模拟支付成功，增加积分
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: pkg.credits } },
    });

    // 记录交易
    await prisma.transaction.create({
      data: {
        userId,
        type: 'recharge',
        amount: pkg.credits,
        balance: updatedUser.credits,
        note: `充值 ${pkg.credits} 积分，支付 ¥${pkg.price}`,
      },
    });

    return new Response(
      JSON.stringify({
        message: '充值成功',
        credits: updatedUser.credits,
        added: pkg.credits,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('充值错误:', error);
    return new Response(
      JSON.stringify({ error: '充值失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 获取充值套餐
export async function GET() {
  return new Response(
    JSON.stringify({
      packages: [
        { id: 'basic', name: '基础套餐', credits: 10, price: 9.9 },
        { id: 'standard', name: '标准套餐', credits: 50, price: 39.9, popular: true },
        { id: 'premium', name: '高级套餐', credits: 200, price: 99.9 },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
