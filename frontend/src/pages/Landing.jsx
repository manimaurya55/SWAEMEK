import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, Users, Sparkles, ArrowUpRight, Building2 } from "lucide-react";

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/0189ebdf-8db6-43d6-91e9-f93170f093e5/images/8bbd332c07a677e2ea6de403aa8c441a35a4b9cd87c473822fb8e21e38e16d98.png";
const STUDENTS = "https://images.pexels.com/photos/1454360/pexels-photo-1454360.jpeg";
const CAMPUS = "https://images.unsplash.com/photo-1709085783594-666111a690d0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwzfHx1bml2ZXJzaXR5JTIwc3R1ZGVudHMlMjBjYW1wdXN8ZW58MHx8fHwxNzc2NjY4NzMzfDA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen" data-testid="landing-page">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass border-b border-[#E5E1D5]" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-8 h-8 bg-[#1A362D] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight">EduCore</span>
          </Link>
          <nav className="hidden md:flex items-center gap-10 text-sm">
            <a href="#features" className="hover:text-[#1A362D]">Modules</a>
            <a href="#roles" className="hover:text-[#1A362D]">For Roles</a>
            <Link to="/pricing" className="hover:text-[#1A362D]" data-testid="nav-pricing-link">Pricing</Link>
            <a href="#about" className="hover:text-[#1A362D]">About</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm" data-testid="nav-login-link">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm" data-testid="nav-register-link">Get started <ArrowUpRight className="w-4 h-4"/></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7 stagger-in">
            <div className="overline mb-8">A SaaS for Institutes · Est. 2026</div>
            <h1 className="font-serif font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
              Run your <em className="not-italic text-[#1A362D]">institute</em>
              <br/>like a modern campus.
            </h1>
            <p className="text-lg text-[#5C5C5C] max-w-xl mt-8 leading-relaxed">
              EduCore unifies admissions, attendance, academics, hostel, library and fees — for admins, HODs, teachers, students and parents — in a single, secure platform.
            </p>
            <div className="flex flex-wrap gap-4 mt-10">
              <Link to="/register" className="btn-primary" data-testid="hero-start-btn">Start free trial <ArrowUpRight className="w-4 h-4"/></Link>
              <Link to="/login" className="btn-secondary" data-testid="hero-login-btn">I have an account</Link>
            </div>
            <div className="flex items-center gap-8 mt-14">
              <div><div className="font-serif text-3xl font-bold">5</div><div className="overline mt-1">Role types</div></div>
              <div className="w-px h-10 bg-[#E5E1D5]"/>
              <div><div className="font-serif text-3xl font-bold">12+</div><div className="overline mt-1">Modules</div></div>
              <div className="w-px h-10 bg-[#E5E1D5]"/>
              <div><div className="font-serif text-3xl font-bold">AI</div><div className="overline mt-1">Assistant</div></div>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <img src={HERO_BG} alt="Campus" className="w-full h-[520px] object-cover"/>
            <div className="absolute -bottom-6 -left-6 glass p-6 w-64 hidden md:block">
              <div className="overline">Today · attendance</div>
              <div className="font-serif text-4xl font-bold mt-2">92.4%</div>
              <div className="text-sm text-[#5C5C5C] mt-2">across 14 departments</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[#E5E1D5]" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
          <div className="overline mb-6">What's inside</div>
          <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">Every module your institute needs, none it doesn't.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
            {[
              {icon: Users, title: "Multi-role Access", body: "Admin, HOD, Teachers, Students, Parents — secure RBAC with unique IDs."},
              {icon: Building2, title: "Departments", body: "Create departments, assign HODs, manage teachers by qualifications."},
              {icon: BookOpen, title: "Attendance", body: "Live session timer, one-click submission, instant notifications."},
              {icon: GraduationCap, title: "Academics & Fees", body: "Marks, academic records and online fee collection in one place."},
              {icon: Sparkles, title: "AI Assistant", body: "Context-aware answers based only on public institute data. Privacy by design."},
              {icon: Building2, title: "Hostel & Library", body: "Rooms, mess counts, book inventory and student borrowings."},
            ].map((f, i) => (
              <div key={i} className="card-flat p-8" data-testid={`feature-card-${i}`}>
                <f.icon className="w-6 h-6 text-[#1A362D]" strokeWidth={2}/>
                <h3 className="font-serif text-2xl font-semibold mt-6">{f.title}</h3>
                <p className="text-[#5C5C5C] mt-3 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-t border-[#E5E1D5] bg-[#EFEBE0]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <img src={STUDENTS} alt="Students" className="w-full h-[480px] object-cover"/>
          </div>
          <div className="lg:col-span-7">
            <div className="overline mb-6">For every seat on campus</div>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight">A dashboard that matches the role.</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
              {[
                {k:"Institute Admin", v:"Manage departments, notices, analytics and onboarding."},
                {k:"HOD", v:"Assign teachers, review attendance, approve academic plans."},
                {k:"Teachers", v:"Take attendance with start/end timer. Submit in one click."},
                {k:"Students", v:"Attendance, marks, fee status, library and hostel in one view."},
                {k:"Parents", v:"Track your child's attendance, fees, performance and message teachers."},
                {k:"AI Assistant", v:"Ask about departments, notices, policies — safely."},
              ].map((r, i) => (
                <div key={i} className="border-l-2 border-[#1A362D] pl-5 py-1">
                  <div className="font-serif text-lg font-semibold">{r.k}</div>
                  <div className="text-sm text-[#5C5C5C] mt-2 leading-relaxed">{r.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-[#E5E1D5]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <div className="overline mb-6">The philosophy</div>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight">Built to feel like a campus, not a CRM.</h2>
            <p className="text-[#5C5C5C] mt-6 leading-relaxed text-lg">
              Education isn't a SaaS funnel. EduCore is structured around the people you serve: first-year students, department heads, anxious parents, tireless teachers. Every screen is data-dense but deeply human.
            </p>
            <Link to="/register" className="btn-primary mt-10" data-testid="about-cta-btn">Create your institute <ArrowUpRight className="w-4 h-4"/></Link>
          </div>
          <div className="lg:col-span-6">
            <img src={CAMPUS} alt="Campus" className="w-full h-[480px] object-cover"/>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E5E1D5] py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-wrap items-center justify-between gap-4 text-sm text-[#5C5C5C]">
          <div>© 2026 EduCore · Built for institutions</div>
          <div className="flex gap-6"><a href="#features">Modules</a><a href="#about">About</a><Link to="/login">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
