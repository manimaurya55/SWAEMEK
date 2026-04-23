import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1400);
    const t2 = setTimeout(() => setShow(false), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-500 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
         style={{background: '#F7F5F0'}} data-testid="splash-screen">
      <div className="text-center">
        <div className="splash-logo inline-block">
          <Logo size={80}/>
        </div>
        <div className="splash-brand font-serif text-5xl lg:text-6xl font-black tracking-tight mt-8" style={{color: '#1A362D'}}>
          SWAMEK
        </div>
        <div className="overline mt-4 splash-tagline">An institute operating system</div>
        <div className="splash-bar mt-10 mx-auto"/>
      </div>
      <style>{`
        @keyframes splashLogoIn { 0% { opacity:0; transform: scale(0.6) rotate(-12deg); } 60% { opacity:1; transform: scale(1.08) rotate(4deg); } 100% { opacity:1; transform: scale(1) rotate(0); } }
        @keyframes splashBrandIn { 0% { opacity:0; transform: translateY(20px); letter-spacing: 0.3em; } 100% { opacity:1; transform: translateY(0); letter-spacing: -0.02em; } }
        @keyframes splashTagIn { 0% { opacity:0; } 100% { opacity:1; } }
        @keyframes splashBar { 0% { width:0; } 100% { width:180px; } }
        .splash-logo { animation: splashLogoIn 800ms cubic-bezier(.2,.7,.2,1) both; }
        .splash-brand { animation: splashBrandIn 700ms 200ms cubic-bezier(.2,.7,.2,1) both; }
        .splash-tagline { animation: splashTagIn 600ms 600ms both; }
        .splash-bar { height: 2px; background: #1A362D; animation: splashBar 900ms 800ms cubic-bezier(.2,.7,.2,1) both; width: 180px; }
      `}</style>
    </div>
  );
}
