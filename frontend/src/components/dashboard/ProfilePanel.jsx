import { useEffect, useState } from "react";
import api from "@/lib/api";
import { QrCode, Download, Share2 } from "lucide-react";

export default function ProfilePanel({ user }) {
  const [qr, setQr] = useState(null);
  const [joinQr, setJoinQr] = useState(null);
  const canJoinQr = ["admin","hod"].includes(user?.role);

  useEffect(() => {
    api.get("/qr/profile").then(r=>setQr(r.data)).catch(()=>{});
    if (canJoinQr) api.get("/qr/institute-join").then(r=>setJoinQr(r.data)).catch(()=>{});
  }, [user]);

  const download = (dataUrl, name) => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = name; a.click();
  };

  const profile = user?.profile || {};

  return (
    <div className="space-y-8" data-testid="profile-panel">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-flat p-8">
          <div className="overline">Profile</div>
          <h1 className="font-serif text-4xl font-bold mt-2">{user?.name}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge-flat">{user?.unique_id}</span>
            <span className="badge-flat">{user?.role}</span>
            {user?.verified && <span className="badge-flat text-[#1A362D]">✓ Verified</span>}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <div><dt className="overline">Email</dt><dd className="mt-1">{user?.email}</dd></div>
            <div><dt className="overline">Phone</dt><dd className="mt-1">{user?.phone || '—'}</dd></div>
            {profile.date_of_birth && <div><dt className="overline">Date of birth</dt><dd className="mt-1">{profile.date_of_birth}</dd></div>}
            {profile.gender && <div><dt className="overline">Gender</dt><dd className="mt-1 capitalize">{profile.gender}</dd></div>}
            {profile.address && <div className="sm:col-span-2"><dt className="overline">Address</dt><dd className="mt-1">{profile.address}</dd></div>}
            {profile.emergency_contact && <div><dt className="overline">Emergency contact</dt><dd className="mt-1">{profile.emergency_contact}</dd></div>}
            {profile.roll_no && <div><dt className="overline">Roll No</dt><dd className="mt-1">{profile.roll_no}</dd></div>}
            {profile.class_name && <div><dt className="overline">Class</dt><dd className="mt-1">{profile.class_name} {profile.section && `· ${profile.section}`}</dd></div>}
            {profile.qualification && <div><dt className="overline">Qualification</dt><dd className="mt-1">{profile.qualification}</dd></div>}
            {profile.subjects && <div><dt className="overline">Subjects</dt><dd className="mt-1">{profile.subjects}</dd></div>}
            {profile.experience_years != null && <div><dt className="overline">Experience</dt><dd className="mt-1">{profile.experience_years} yrs</dd></div>}
            {profile.designation && <div><dt className="overline">Designation</dt><dd className="mt-1">{profile.designation}</dd></div>}
            {profile.child_name && <div><dt className="overline">Child</dt><dd className="mt-1">{profile.child_name} {profile.child_roll_no && `(Roll ${profile.child_roll_no})`}</dd></div>}
          </dl>
        </div>
        <div className="card-flat p-8 flex flex-col items-center text-center" data-testid="profile-qr-card">
          <div className="overline"><QrCode className="w-3 h-3 inline mr-1"/> My QR</div>
          <h3 className="font-serif text-xl font-bold mt-2">Scan to verify</h3>
          {qr?.qr ? (
            <>
              <img src={qr.qr} alt="QR" className="w-56 h-56 mt-5 border border-[#E5E1D5]"/>
              <button onClick={()=>download(qr.qr, `${user?.unique_id}-qr.png`)} className="btn-secondary text-xs mt-4" data-testid="download-profile-qr">
                <Download className="w-3 h-3"/> Download
              </button>
            </>
          ) : <div className="text-sm text-[#5C5C5C] mt-8">Loading QR…</div>}
          <div className="text-xs text-[#5C5C5C] mt-4">ID, role & institute encoded</div>
        </div>
      </div>

      {canJoinQr && joinQr && (
        <div className="card-flat p-8" data-testid="institute-join-qr">
          <div className="flex flex-wrap items-center gap-8">
            <img src={joinQr.qr} alt="Institute join QR" className="w-48 h-48 border border-[#E5E1D5]"/>
            <div className="flex-1 min-w-[240px]">
              <div className="overline">Institute join QR</div>
              <h3 className="font-serif text-2xl font-bold mt-2">Onboard new members instantly</h3>
              <p className="text-[#5C5C5C] mt-2 leading-relaxed">Share this QR with students, teachers and parents. Scanning opens registration with your institute code pre-filled.</p>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <span className="badge-flat">Code · {joinQr.code}</span>
                <button onClick={()=>download(joinQr.qr, `${joinQr.code}-join-qr.png`)} className="btn-secondary text-xs" data-testid="download-join-qr"><Download className="w-3 h-3"/> Download</button>
                <button onClick={()=>{navigator.clipboard.writeText(joinQr.url); }} className="btn-secondary text-xs" data-testid="copy-join-url"><Share2 className="w-3 h-3"/> Copy link</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
