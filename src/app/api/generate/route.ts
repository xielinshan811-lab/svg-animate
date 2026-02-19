// ========================================
// SVG 动画生成 API - DeepSeek
// ========================================

import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

// SVG 动画生成的系统提示词
const SYSTEM_PROMPT = `你是一个专业的 SVG 动画生成专家。根据用户描述生成 SVG 动画代码。

严格要求：
1. 只输出纯 SVG 代码，不要任何解释、markdown 标记或代码块符号
2. 直接以 <svg 开头，以 </svg> 结尾
3. 必须包含 xmlns="http://www.w3.org/2000/svg"
4. 必须设置 viewBox="0 0 400 300"
5. 必须包含动画元素（animate, animateTransform, animateMotion）
6. 所有动画必须设置 repeatCount="indefinite" 实现无限循环
7. 使用鲜艳的颜色

示例（跳动的心形）：
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <path d="M200 250 C200 250 100 150 100 100 C100 50 150 50 200 100 C250 50 300 50 300 100 C300 150 200 250 200 250Z" fill="#ff4757">
    <animateTransform attributeName="transform" type="scale" values="1;1.1;1" dur="0.8s" repeatCount="indefinite" additive="sum" origin="200 150"/>
  </path>
</svg>

记住：直接输出 SVG 代码，不要任何其他文字！`;

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: '请输入有效的提示词' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证用户登录状态和积分
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const { payload } = await jwtVerify(token, SECRET);
        userId = payload.userId as string;

        // 检查用户积分
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        if (!user || user.credits < 1) {
          return new Response(
            JSON.stringify({ error: '积分不足，请充值' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 扣减积分
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } },
        });

        // 记录交易
        await prisma.transaction.create({
          data: {
            userId,
            type: 'use',
            amount: -1,
            balance: updatedUser.credits,
            note: `生成SVG动画: ${prompt.slice(0, 50)}`,
          },
        });
      } catch {
        // Token 无效，继续但不扣积分
      }
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === '你的API密钥粘贴在这里') {
      return new Response(
        JSON.stringify({ error: '请先配置 DEEPSEEK_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请生成以下 SVG 动画：${prompt}` }
        ],
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 错误:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI 服务调用失败' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (error) {
          console.error('流处理错误:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('API 错误:', error);
    return new Response(
      JSON.stringify({ error: '生成失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
