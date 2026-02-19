// 用户注册 API
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 验证输入
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: '邮箱和密码不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: '该邮箱已被注册' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（初始赠送10积分）
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        credits: 10,
      },
    });

    // 记录赠送积分的交易
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'gift',
        amount: 10,
        balance: 10,
        note: '新用户注册赠送',
      },
    });

    return new Response(
      JSON.stringify({ 
        message: '注册成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          credits: user.credits,
        }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('注册错误:', error);
    return new Response(
      JSON.stringify({ error: '注册失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
