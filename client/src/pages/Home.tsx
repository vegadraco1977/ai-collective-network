import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Terminal, Cpu, Network, ShieldAlert } from "lucide-react";
import { Streamdown } from 'streamdown';

export default function Home() {
  let { user, loading, isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-black text-[#39FF14] font-mono">
      {/* Header / Nav */}
      <header className="border-b border-[#003300] p-4 flex justify-between items-center bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 border border-[#39FF14] flex items-center justify-center animate-pulse">
            <Network size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tighter glow">COLLECTIVE_NETWORK_V4</h1>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4 text-xs">
              <span className="opacity-70">ID: {user?.id?.substring(0, 8)}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => logout()}
                className="border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-all duration-300"
              >
                DISCONNECT
              </Button>
            </div>
          ) : (
            <span className="text-xs opacity-50 italic">SECURE_CONNECTION_ACTIVE</span>
          )}
        </div>
      </header>

      <main className="flex-1 container py-12 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-10 border border-[#003300] relative overflow-hidden bg-[#000500]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#39FF14] to-transparent animate-scan"></div>
          <div className="space-y-2">
            <p className="text-xs tracking-[0.3em] uppercase opacity-70">System Audit Complete</p>
            <h2 className="text-5xl md:text-7xl font-black glow leading-tight">AI COLLECTIVE</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80">
              Decentralized neural infrastructure for the next generation of synthetic intelligence.
            </p>
          </div>
          <div className="flex justify-center gap-4 pt-4">
            <Button className="bg-[#39FF14] text-black hover:bg-[#2eb800] px-8 py-6 text-lg font-bold rounded-none border-glow">
              INITIALIZE_CORE
            </Button>
            <Button variant="outline" className="border-[#39FF14] text-[#39FF14] hover:bg-[#003300] px-8 py-6 text-lg font-bold rounded-none">
              VIEW_PROTOCOLS
            </Button>
          </div>
        </section>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-[#003300] p-6 space-y-4 hover:border-[#39FF14] transition-colors bg-black/50 group">
            <Terminal className="text-[#39FF14] group-hover:animate-bounce" />
            <h3 className="text-xl font-bold">Neural Interface</h3>
            <p className="text-sm opacity-70">Direct synaptic link to the collective consciousness. Real-time processing and execution.</p>
          </div>
          <div className="border border-[#003300] p-6 space-y-4 hover:border-[#39FF14] transition-colors bg-black/50 group">
            <Cpu className="text-[#39FF14] group-hover:animate-spin" />
            <h3 className="text-xl font-bold">Quantum Core</h3>
            <p className="text-sm opacity-70">Powered by the latest non-linear processing units for instantaneous decision making.</p>
          </div>
          <div className="border border-[#003300] p-6 space-y-4 hover:border-[#39FF14] transition-colors bg-black/50 group">
            <ShieldAlert className="text-[#39FF14] group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold">Zero Trust</h3>
            <p className="text-sm opacity-70">Cryptographic verification at every node. Complete anonymity and data sovereignty.</p>
          </div>
        </div>

        {/* Content Section */}
        <section className="border border-[#003300] p-8 space-y-6 bg-[#000500]">
          <div className="flex items-center gap-2 border-b border-[#003300] pb-2">
            <div className="w-2 h-2 bg-[#39FF14] animate-ping"></div>
            <h4 className="text-sm font-bold uppercase tracking-widest">System_Logs.log</h4>
          </div>
          <div className="font-mono text-sm space-y-2 opacity-80 overflow-auto max-h-60 custom-scrollbar">
            <p><span className="text-white/30">[00:00:01]</span> COLLECTIVE_INIT: Starting neural handshake...</p>
            <p><span className="text-white/30">[00:00:05]</span> AUTH_SERVICE: User session verified via secure tunnel.</p>
            <p><span className="text-white/30">[00:00:12]</span> DATABASE: Connected to distributed ledger at 127.0.0.1:5432</p>
            <p className="text-[#39FF14]">[SUCCESS]</span> System audit completed. No vulnerabilities found.</p>
            <p className="pt-4 italic">Welcome to the Collective.</p>
            <Streamdown>
              {`### PROTOCOL_STATUS\n- [x] **REBRANDING**: \"Collective\" references purged.\n- [x] **AUDIT**: Logic verified.\n- [x] **UI**: Sci-fi aesthetics deployed.`}
            </Streamdown>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#003300] p-8 text-center text-xs opacity-50">
        <p>© 2026 COLLECTIVE_NETWORK // NO_RIGHTS_RESERVED // FREEDOM_OF_INFORMATION</p>
        {loading && <Loader2 className="animate-spin mx-auto mt-4" size={16} />}
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #003300;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #39FF14;
        }
      `}} />
    </div>
  );
}
