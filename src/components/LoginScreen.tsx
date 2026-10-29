import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: { username: string; name: string }) => void;
}

export const VALID_USERS = [
  { username: 'arnaldo', name: 'Arnaldo', password: '7284' },
  { username: 'rafael', name: 'Rafael', password: '7284' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Por favor, preencha o usuário e a senha.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const foundUser = VALID_USERS.find(
        (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
      );

      if (foundUser) {
        onLogin({ username: foundUser.username, name: foundUser.name });
      } else {
        setIsLoading(false);
        setErrorMessage('Usuário ou senha inválidos. Tente novamente.');
      }
    }, 350);
  };

  const handleQuickLogin = (userItem: (typeof VALID_USERS)[0]) => {
    setUsername(userItem.username);
    setPassword(userItem.password);
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      onLogin({ username: userItem.username, name: userItem.name });
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-7 sm:p-9 space-y-6">
          {/* Logo Branding */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <img
                src="/assets/aistudio/Logo_ARtex7_em_Preto_254e2cb7.png"
                alt="ARTEX7"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Acesso Restrito ao Sistema</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Entrar na sua Conta
            </h2>
            <p className="text-xs text-slate-500">
              Digite suas credenciais de operador para gerenciar pedidos e OCR.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-in shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="arnaldo ou rafael"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Badges for the 2 Authorized Users */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Acesso Rápido de Usuário (1 Toque)
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {VALID_USERS.map((userItem) => (
                <button
                  key={userItem.username}
                  type="button"
                  onClick={() => handleQuickLogin(userItem)}
                  className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center uppercase group-hover:scale-105 transition-transform">
                    {userItem.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 truncate">
                      {userItem.name}
                    </p>
                    <p className="text-[10px] text-slate-400">Operador</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-2">
          <span>ARTEX7 Sistema de Pedidos & OCR</span>
          <span>•</span>
          <span>Segurança Ativa</span>
        </div>
      </div>
    </div>
  );
};
