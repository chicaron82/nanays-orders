import { useState } from 'react';
import { ChefHat, Lock } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (error) {
      // Error is handled by the toast in useAuth, but we catch it here to reset loading
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background elements */}
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
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-orange-500 focus:bg-black/40 outline-none transition-all"
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
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-orange-500 focus:bg-black/40 outline-none transition-all"
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
  );
}
