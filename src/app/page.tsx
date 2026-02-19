// ========================================
// SVG 动画生成器 - 完整版（含用户系统）
// ========================================

'use client';

import { useState, useEffect } from 'react';

// 用户类型
interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
}

// 充值套餐类型
interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
}

export default function Home() {
  // 状态
  const [prompt, setPrompt] = useState('');
  const [svgCode, setSvgCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  
  // 用户相关状态
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState('');
  const [packages, setPackages] = useState<Package[]>([]);

  // 初始化：从 localStorage 恢复登录状态
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    }
    fetchPackages();
  }, []);

  // 获取用户信息
  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/user', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token 无效，清除登录状态
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch {
      console.error('获取用户信息失败');
    }
  };

  // 获取充值套餐
  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/recharge');
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages);
      }
    } catch {
      console.error('获取套餐失败');
    }
  };

  // 登录/注册
  const handleAuth = async () => {
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (authMode === 'register') {
          // 注册成功，自动登录
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authForm.email, password: authForm.password }),
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            setToken(loginData.token);
            setUser(loginData.user);
            localStorage.setItem('token', loginData.token);
          }
        } else {
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem('token', data.token);
        }
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '', name: '' });
      } else {
        setAuthError(data.error || '操作失败');
      }
    } catch {
      setAuthError('网络错误，请重试');
    }
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // 充值
  const handleRecharge = async (packageId: string) => {
    if (!token) return;
    
    try {
      const res = await fetch('/api/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setUser(prev => prev ? { ...prev, credits: data.credits } : null);
        setShowRechargeModal(false);
        alert(`充值成功！获得 ${data.added} 积分`);
      } else {
        alert(data.error || '充值失败');
      }
    } catch {
      alert('充值失败，请重试');
    }
  };

  // 提取 SVG
  const extractSvg = (text: string): string => {
    const match = text.match(/<svg[\s\S]*?<\/svg>/i);
    return match ? match[0] : '';
  };

  // 生成动画
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    // 检查是否登录
    if (!token) {
      setShowAuthModal(true);
      return;
    }

    // 检查积分
    if (user && user.credits < 1) {
      setShowRechargeModal(true);
      return;
    }
    
    setIsLoading(true);
    setSvgCode('');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (response.status === 403) {
        setShowRechargeModal(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        setSvgCode(`错误: ${error.error || '生成失败'}`);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        setSvgCode('无法读取响应');
        setIsLoading(false);
        return;
      }

      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        fullText += text;
        setSvgCode(fullText);
      }

      // 刷新用户积分
      if (token) fetchUser(token);
      
    } catch (error) {
      console.error('请求错误:', error);
      setSvgCode('请求失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const pureSvg = extractSvg(svgCode);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      
      {/* 导航栏 */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-orange-500">SVG Animate</h1>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* 积分显示 */}
                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9V7h2v2H9zm0 4V10h2v4H9z"/>
                  </svg>
                  <span className="text-yellow-500 font-medium">{user.credits}</span>
                  <span className="text-gray-400 text-sm">积分</span>
                </button>
                
                {/* 用户菜单 */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">{user.name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    退出
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-400 transition-colors"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左侧：输入区 */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold mb-2">AI SVG 动画生成器</h2>
              <p className="text-gray-400">描述你想要的动画，AI 帮你生成</p>
              {user && (
                <p className="text-sm text-gray-500 mt-1">
                  每次生成消耗 1 积分，当前剩余 <span className="text-yellow-500">{user.credits}</span> 积分
                </p>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <label className="block text-sm text-orange-400 mb-2">动画描述</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：一个旋转的太阳，周围有行星环绕..."
                className="w-full h-40 bg-gray-800 text-white rounded-lg p-4 border border-gray-700 focus:border-orange-500 focus:outline-none resize-none"
              />
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">{prompt.length} / 500</span>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-medium rounded-lg hover:from-orange-400 hover:to-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      生成动画 (-1积分)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 示例 */}
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400 mb-3">试试这些例子：</p>
              <div className="flex flex-wrap gap-2">
                {['跳动的心形', '旋转的地球', '下雨的云朵', '闪烁的星星', '游动的鱼', '弹跳的小球'].map((example) => (
                  <button
                    key={example}
                    onClick={() => setPrompt(example)}
                    className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：预览区 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{showCode ? 'SVG 代码' : '动画预览'}</h3>
              <button
                onClick={() => setShowCode(!showCode)}
                className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {showCode ? '查看预览' : '查看代码'}
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden" style={{ minHeight: '400px' }}>
              {showCode ? (
                <pre className="p-4 text-sm text-gray-300 overflow-auto h-[400px]">
                  <code>{svgCode || '// SVG 代码将显示在这里'}</code>
                </pre>
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-gray-800/50 p-4">
                  {pureSvg ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:transparent}svg{max-width:100%;max-height:100%}</style></head><body>${pureSvg}</body></html>`}
                      className="w-full h-full border-0 bg-transparent"
                      title="SVG Preview"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                          <svg className="animate-spin h-10 w-10 text-orange-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <p>正在生成动画...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <svg className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p>动画预览区</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {pureSvg && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const blob = new Blob([pureSvg], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'animation.svg';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载 SVG
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pureSvg);
                    alert('已复制到剪贴板！');
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  复制代码
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 登录/注册弹窗 */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-800">
            <h3 className="text-xl font-bold mb-4">
              {authMode === 'login' ? '登录' : '注册'}
            </h3>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {authError}
              </div>
            )}
            
            <div className="space-y-4">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="昵称（可选）"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              )}
              <input
                type="email"
                placeholder="邮箱"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
              />
              <input
                type="password"
                placeholder="密码"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
              />
              
              <button
                onClick={handleAuth}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-medium rounded-lg hover:from-orange-400 hover:to-rose-400 transition-colors"
              >
                {authMode === 'login' ? '登录' : '注册'}
              </button>
              
              <p className="text-center text-gray-400 text-sm">
                {authMode === 'login' ? '没有账号？' : '已有账号？'}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                  }}
                  className="text-orange-400 hover:text-orange-300 ml-1"
                >
                  {authMode === 'login' ? '立即注册' : '去登录'}
                </button>
              </p>
              
              {authMode === 'register' && (
                <p className="text-center text-green-400 text-sm">
                  🎁 新用户注册即送 10 积分！
                </p>
              )}
            </div>
            
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 充值弹窗 */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg mx-4 border border-gray-800 relative">
            <h3 className="text-xl font-bold mb-2">充值积分</h3>
            <p className="text-gray-400 text-sm mb-6">选择充值套餐，立即到账</p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleRecharge(pkg.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all hover:border-orange-500 ${
                    pkg.popular ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                      推荐
                    </span>
                  )}
                  <div className="text-2xl font-bold text-yellow-500 mb-1">{pkg.credits}</div>
                  <div className="text-sm text-gray-400 mb-2">积分</div>
                  <div className="text-lg font-medium">¥{pkg.price}</div>
                </button>
              ))}
            </div>
            
            <p className="text-center text-gray-500 text-xs">
              * 这是演示项目，点击即模拟充值成功
            </p>
            
            <button
              onClick={() => setShowRechargeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 底部 */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center text-gray-500 text-sm mt-8">
        SVG Animate - AI 驱动的 SVG 动画生成器
      </footer>
    </div>
  );
}
