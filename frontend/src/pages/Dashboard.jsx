import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { LogOut, Bell, LayoutGrid, Building2, Users, ClipboardList, Megaphone, MessageSquare, Home, Library as LibIcon, Wallet, FileUp, Sparkles, Image as ImageIcon, UserCircle, CreditCard, Award, BarChart3 } from "lucide-react";
import Logo from "@/components/Logo";
import OverviewPanel from "@/components/dashboard/OverviewPanel";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import UsersPanel from "@/components/dashboard/UsersPanel";
import AttendancePanel from "@/components/dashboard/AttendancePanel";
import NoticesPanel from "@/components/dashboard/NoticesPanel";
import MessagesPanel from "@/components/dashboard/MessagesPanel";
import HostelPanel from "@/components/dashboard/HostelPanel";
import LibraryPanel from "@/components/dashboard/LibraryPanel";
import FeesPanel from "@/components/dashboard/FeesPanel";
import UploadPanel from "@/components/dashboard/UploadPanel";
import AIAssistant from "@/components/dashboard/AIAssistant";
import GalleryPanel from "@/components/dashboard/GalleryPanel";
import ProfilePanel from "@/components/dashboard/ProfilePanel";
import BillingPanel from "@/components/dashboard/BillingPanel";
import ResultsPanel from "@/components/dashboard/ResultsPanel";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";

const MENU = [
  { id: "overview", label: "Overview", icon: LayoutGrid, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "analytics", label: "Analytics", icon: BarChart3, roles: ["admin","hod"] },
  { id: "profile", label: "My Profile", icon: UserCircle, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "departments", label: "Departments", icon: Building2, roles: ["admin","hod","teacher","student","parent"] },
  { id: "users", label: "People", icon: Users, roles: ["admin","hod","teacher"] },
  { id: "attendance", label: "Attendance", icon: ClipboardList, roles: ["admin","hod","teacher","student","parent"] },
  { id: "results", label: "Exam Results", icon: Award, roles: ["admin","hod","teacher","student","parent"] },
  { id: "notices", label: "Notices", icon: Megaphone, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "messages", label: "Messages", icon: MessageSquare, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "gallery", label: "Gallery", icon: ImageIcon, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "hostel", label: "Hostel & Mess", icon: Home, roles: ["admin","hod","teacher","student","parent","hostel_staff"] },
  { id: "library", label: "Library", icon: LibIcon, roles: ["admin","hod","teacher","student","parent"] },
  { id: "fees", label: "Fees", icon: Wallet, roles: ["admin","hod","student","parent"] },
  { id: "billing", label: "Billing & Plan", icon: CreditCard, roles: ["admin"] },
  { id: "upload", label: "PDF Import", icon: FileUp, roles: ["admin","hod"] },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [institute, setInstitute] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    // Redirect superadmin to their own console
    if (user?.role === "superadmin") { nav("/super-admin"); return; }
    api.get("/institute").then((r)=>setInstitute(r.data)).catch(()=>{});
    const fetchN = () => api.get("/notifications").then((r)=>setNotifs(r.data)).catch(()=>{});
    fetchN();
    const t = setInterval(fetchN, 12000);
    return () => clearInterval(t);
  }, [user, nav]);

  const unread = notifs.filter(n=>!n.read).length;
  const availableMenu = MENU.filter(m => m.roles.includes(user?.role));

  const renderPanel = () => {
    switch (tab) {
      case "overview": return <OverviewPanel user={user} institute={institute}/>;
      case "analytics": return <AnalyticsPanel/>;
      case "profile": return <ProfilePanel user={user}/>;
      case "departments": return <DepartmentsPanel user={user}/>;
      case "users": return <UsersPanel user={user}/>;
      case "attendance": return <AttendancePanel user={user}/>;
      case "results": return <ResultsPanel user={user}/>;
      case "notices": return <NoticesPanel user={user}/>;
      case "messages": return <MessagesPanel user={user}/>;
      case "gallery": return <GalleryPanel user={user}/>;
      case "hostel": return <HostelPanel user={user}/>;
      case "library": return <LibraryPanel user={user}/>;
      case "fees": return <FeesPanel user={user}/>;
      case "billing": return <BillingPanel user={user}/>;
      case "upload": return <UploadPanel user={user}/>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="dashboard-page">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#E5E1D5] bg-white/60 flex-shrink-0 hidden lg:flex flex-col" data-testid="dashboard-sidebar">
        <div className="px-6 py-6 border-b border-[#E5E1D5] flex items-center gap-2">
          <Logo size={32}/>
          <div>
            <div className="font-serif text-lg font-bold leading-none">SWAMEK</div>
            <div className="text-xs text-[#5C5C5C] mt-1">{institute?.name || 'Institute'}</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 scroll-fade overflow-y-auto">
          {availableMenu.map((m) => (
            <button key={m.id} onClick={()=>setTab(m.id)} data-testid={`menu-${m.id}`}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm transition border-l-2 ${tab===m.id ? 'border-[#1A362D] bg-[#F7F5F0] text-[#1A362D] font-medium' : 'border-transparent text-[#1A1A1A] hover:bg-[#F7F5F0]'}`}>
              <m.icon className="w-4 h-4"/> {m.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#E5E1D5]">
          <div className="text-xs overline mb-2">Signed in as</div>
          <div className="text-sm font-medium">{user?.name}</div>
          <div className="text-xs text-[#5C5C5C]">{user?.unique_id} · {user?.role}</div>
          <button onClick={logout} className="btn-secondary mt-4 w-full justify-center text-sm" data-testid="logout-btn">
            <LogOut className="w-4 h-4"/> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 glass border-b border-[#E5E1D5]" data-testid="dashboard-header">
          <div className="px-6 lg:px-10 py-4 flex items-center justify-between">
            <div>
              <div className="overline">{user?.role}</div>
              <h2 className="font-serif text-2xl font-bold tracking-tight capitalize">{MENU.find(m=>m.id===tab)?.label || 'Dashboard'}</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* mobile menu */}
              <select value={tab} onChange={(e)=>setTab(e.target.value)} className="lg:hidden !w-auto" data-testid="mobile-menu-select">
                {availableMenu.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div className="relative">
                <button onClick={()=>setShowNotifs(!showNotifs)} className="relative p-2 border border-[#E5E1D5] bg-white" data-testid="notifications-btn">
                  <Bell className="w-4 h-4"/>
                  {unread>0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D46B4E] text-white text-[10px] rounded-full flex items-center justify-center">{unread}</span>}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 glass border border-[#E5E1D5] shadow-xl max-h-96 overflow-y-auto scroll-fade z-40" data-testid="notifications-dropdown">
                    <div className="p-3 border-b border-[#E5E1D5] font-medium text-sm">Notifications</div>
                    {notifs.length === 0 && <div className="p-4 text-sm text-[#5C5C5C]">No notifications yet.</div>}
                    {notifs.map(n=>(
                      <div key={n.id} className={`p-3 border-b border-[#E5E1D5] text-sm ${!n.read ? 'bg-[#F7F5F0]' : ''}`} onClick={()=>api.post(`/notifications/${n.id}/read`).then(()=>setNotifs(notifs.map(x=>x.id===n.id?{...x,read:true}:x)))}>
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-[#5C5C5C] mt-1">{n.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={logout} className="lg:hidden p-2 border border-[#E5E1D5] bg-white" data-testid="logout-mobile-btn"><LogOut className="w-4 h-4"/></button>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 stagger-in" data-testid={`panel-${tab}`}>
          {institute && institute.status && institute.status !== "verified" && user?.role === "admin" && (
            <div className="mb-6 p-5 border-l-4 border-[#D46B4E] bg-[#FFF6EE]" data-testid="pending-verification-banner">
              <div className="overline text-[#D46B4E]">Awaiting platform verification</div>
              <div className="font-serif text-lg font-bold mt-1">Your institute is pending approval.</div>
              <div className="text-sm text-[#5C5C5C] mt-2">Other members cannot register yet. The Platform Owner will verify you shortly. Your institute code is <b>{institute.code}</b>.</div>
            </div>
          )}
          {renderPanel()}
        </div>
      </main>

      {/* AI Widget */}
      <button onClick={()=>setShowAI(!showAI)} className="fixed bottom-6 right-6 z-40 bg-[#1A362D] text-white p-4 rounded-full shadow-xl hover:bg-[#264F42]" data-testid="ai-toggle-btn">
        <Sparkles className="w-5 h-5"/>
      </button>
      {showAI && <AIAssistant onClose={()=>setShowAI(false)}/>}
    </div>
  );
}
