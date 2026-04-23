import "@/index.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import SuperAdmin from "@/pages/SuperAdmin";
import Pricing from "@/pages/Pricing";
import BillingSuccess from "@/pages/BillingSuccess";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SplashScreen from "@/components/SplashScreen";
import { Toaster } from "sonner";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#5C5C5C]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem("swamek_splashed"));
  useEffect(() => {
    if (showSplash) {
      const t = setTimeout(() => { sessionStorage.setItem("swamek_splashed", "1"); setShowSplash(false); }, 2100);
      return () => clearTimeout(t);
    }
  }, [showSplash]);

  return (
    <AuthProvider>
      {showSplash && <SplashScreen />}
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/billing/success" element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
          <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
