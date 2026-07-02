import { useState } from 'react';
import { ChefHat, Lock, UtensilsCrossed, ArrowRight } from 'lucide-react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        <a
          href="/request"
          className="group flex items-center gap-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 shadow-2xl shadow-emerald-900/30 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.99] transition-all"
        >
          <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
            <UtensilsCrossed className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-white font-black font-playfair text-lg leading-tight">Want to place an order?</p>
            <p className="text-white/80 font-lato text-xs">This page is for the kitchen team — order here instead</p>
          </div>
          <ArrowRight className="text-white shrink-0 group-hover:translate-x-1 transition-transform" size={22} />
        </a>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ChefHat size={120} />
        </div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-orange-600 to-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <ChefHat className="text-white" size={32} />
            </div>
            <h1 className="font-playfair text-white text-3xl font-black mb-2">Nanay's Orders</h1>
            <p className="text-white/70 font-lato text-sm">Kitchen Command Center</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus-visible:border-orange-500 focus-visible:bg-black/40 focus-visible:ring-2 focus-visible:ring-white/30 outline-none transition-all"
                placeholder="nanay@kitchen.com"
                required
              />
            </div>

            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus-visible:border-orange-500 focus-visible:bg-black/40 focus-visible:ring-2 focus-visible:ring-white/30 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock size={18} /> Unlock Kitchen
                </>
              )}
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
