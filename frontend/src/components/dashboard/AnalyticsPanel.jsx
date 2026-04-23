import { useEffect, useState } from "react";
import api from "@/lib/api";
import { BarChart3, TrendingUp, Wallet, Users as UsersIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1A362D", "#D46B4E", "#DDAA55", "#8E9E90", "#264F42", "#B4442A"];

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/analytics/dashboard").then(r=>setData(r.data)).catch(()=>{}); }, []);

  if (!data) return <div className="text-sm text-[#5C5C5C]">Loading analytics…</div>;

  const feePie = [
    { name: "Paid", value: data.fee_summary.paid_amount },
    { name: "Pending", value: data.fee_summary.pending_amount },
  ];

  return (
    <div className="space-y-8" data-testid="analytics-panel">
      <div className="overline">Institute analytics</div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-flat p-6" data-testid="stat-attendance">
          <div className="overline"><TrendingUp className="w-3 h-3 inline mr-1"/>Today</div>
          <div className="font-serif text-4xl font-black mt-3">{data.attendance_trend[data.attendance_trend.length-1]?.percentage || 0}%</div>
          <div className="text-xs text-[#5C5C5C] mt-1">attendance</div>
        </div>
        <div className="card-flat p-6" data-testid="stat-fees-paid">
          <div className="overline"><Wallet className="w-3 h-3 inline mr-1"/>Fees paid</div>
          <div className="font-serif text-4xl font-black mt-3 text-[#1A362D]">₹{data.fee_summary.paid_amount.toLocaleString()}</div>
          <div className="text-xs text-[#5C5C5C] mt-1">{data.fee_summary.paid_count} invoices</div>
        </div>
        <div className="card-flat p-6" data-testid="stat-fees-pending">
          <div className="overline">Pending</div>
          <div className="font-serif text-4xl font-black mt-3 text-[#B4442A]">₹{data.fee_summary.pending_amount.toLocaleString()}</div>
          <div className="text-xs text-[#5C5C5C] mt-1">{data.fee_summary.pending_count} invoices</div>
        </div>
        <div className="card-flat p-6" data-testid="stat-users">
          <div className="overline"><UsersIcon className="w-3 h-3 inline mr-1"/>Total users</div>
          <div className="font-serif text-4xl font-black mt-3">{data.role_distribution.reduce((a,r)=>a+r.count,0)}</div>
          <div className="text-xs text-[#5C5C5C] mt-1">across {data.role_distribution.length} roles</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-flat p-6" data-testid="chart-attendance">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-[#1A362D]"/><h3 className="font-serif text-xl font-bold">Attendance · last 7 days</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.attendance_trend}>
              <CartesianGrid stroke="#E5E1D5" strokeDasharray="3 3"/>
              <XAxis dataKey="date" stroke="#5C5C5C" fontSize={12}/>
              <YAxis stroke="#5C5C5C" fontSize={12}/>
              <Tooltip contentStyle={{background:'#fff', border:'1px solid #E5E1D5'}}/>
              <Line type="monotone" dataKey="percentage" stroke="#1A362D" strokeWidth={2} dot={{fill:'#D46B4E', r:4}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat p-6" data-testid="chart-roles">
          <div className="flex items-center gap-2 mb-4"><UsersIcon className="w-4 h-4 text-[#1A362D]"/><h3 className="font-serif text-xl font-bold">Role distribution</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.role_distribution}>
              <CartesianGrid stroke="#E5E1D5" strokeDasharray="3 3"/>
              <XAxis dataKey="role" stroke="#5C5C5C" fontSize={11}/>
              <YAxis stroke="#5C5C5C" fontSize={12}/>
              <Tooltip contentStyle={{background:'#fff', border:'1px solid #E5E1D5'}}/>
              <Bar dataKey="count" fill="#1A362D" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat p-6" data-testid="chart-fees">
          <div className="flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-[#1A362D]"/><h3 className="font-serif text-xl font-bold">Fee collection</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={feePie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={(e)=>`₹${e.value.toLocaleString()}`}>
                {feePie.map((_, i) => <Cell key={i} fill={COLORS[i]}/>)}
              </Pie>
              <Legend/>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat p-6" data-testid="chart-subjects">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-[#1A362D]"/><h3 className="font-serif text-xl font-bold">Subject performance (avg %)</h3></div>
          {data.subject_performance.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-[#5C5C5C]">No published results yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.subject_performance} layout="vertical">
                <CartesianGrid stroke="#E5E1D5" strokeDasharray="3 3"/>
                <XAxis type="number" stroke="#5C5C5C" fontSize={12}/>
                <YAxis type="category" dataKey="subject" stroke="#5C5C5C" fontSize={12} width={100}/>
                <Tooltip contentStyle={{background:'#fff', border:'1px solid #E5E1D5'}}/>
                <Bar dataKey="avg" fill="#D46B4E" radius={[0,2,2,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
