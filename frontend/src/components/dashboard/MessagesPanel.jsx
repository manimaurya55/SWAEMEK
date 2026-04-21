import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Send, MessageCircle } from "lucide-react";

export default function MessagesPanel({ user }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const endRef = useRef(null);

  const loadConv = () => api.get("/messages/conversations").then(r=>setConversations(r.data)).catch(()=>{});
  useEffect(() => {
    loadConv();
    api.get("/users").then(r=>setContacts(r.data.filter(u=>u.id!==user.id)));
    const t = setInterval(loadConv, 10000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (!active) return;
    const load = () => api.get("/messages", { params: { with_user: active.user_id || active.id }}).then(r=>setMsgs(r.data));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text; setText("");
    const toId = active.user_id || active.id;
    await api.post("/messages", { to_user_id: toId, body });
    api.get("/messages", { params: { with_user: toId }}).then(r=>setMsgs(r.data));
    loadConv();
  };

  const startNew = (c) => {
    setActive({ user_id: c.id, name: c.name, role: c.role, unique_id: c.unique_id });
    setShowNew(false);
  };

  const filteredContacts = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.unique_id||'').toLowerCase().includes(search.toLowerCase())
  );

  const activeId = active?.user_id || active?.id;

  return (
    <div className="card-flat overflow-hidden grid grid-cols-1 md:grid-cols-3 h-[70vh]" data-testid="messages-panel">
      <div className="border-r border-[#E5E1D5] flex flex-col" data-testid="conversations-list">
        <div className="p-3 border-b border-[#E5E1D5] flex items-center justify-between">
          <div className="overline">Conversations</div>
          <button onClick={()=>setShowNew(!showNew)} className="text-xs underline" data-testid="new-chat-btn">{showNew ? 'Close' : '+ New'}</button>
        </div>
        {showNew ? (
          <div className="flex-1 overflow-y-auto scroll-fade">
            <input className="!border-0 !border-b !rounded-none" placeholder="Search contacts…" value={search} onChange={(e)=>setSearch(e.target.value)} data-testid="contact-search"/>
            {filteredContacts.length === 0 && <div className="p-4 text-sm text-[#5C5C5C]">No contacts.</div>}
            {filteredContacts.map(c=>(
              <button key={c.id} onClick={()=>startNew(c)} data-testid={`new-contact-${c.id}`} className="w-full text-left p-4 border-b border-[#E5E1D5] hover:bg-[#F7F5F0]">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-[#5C5C5C]">{c.role} · {c.unique_id}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-fade">
            {conversations.length === 0 && (
              <div className="p-6 text-sm text-[#5C5C5C] text-center">
                <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#E5E1D5]"/>
                No conversations yet. Click <b>+ New</b> to start.
              </div>
            )}
            {conversations.map(c=>(
              <button key={c.user_id} onClick={()=>setActive(c)} data-testid={`conv-${c.user_id}`}
                className={`w-full text-left p-4 border-b border-[#E5E1D5] hover:bg-[#F7F5F0] ${activeId===c.user_id?'bg-[#F7F5F0]':''}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-[#5C5C5C] mt-0.5">{c.role}</div>
                    <div className="text-xs text-[#5C5C5C] mt-1 truncate">{c.last_message}</div>
                  </div>
                  {c.unread > 0 && <span className="bg-[#D46B4E] text-white text-[10px] px-2 py-0.5 rounded-full">{c.unread}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="md:col-span-2 flex flex-col">
        {active ? (
          <>
            <div className="p-4 border-b border-[#E5E1D5]">
              <div className="font-medium">{active.name}</div>
              <div className="text-xs text-[#5C5C5C]">{active.role} {active.unique_id && `· ${active.unique_id}`}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 scroll-fade" data-testid="messages-thread">
              {msgs.length === 0 && <div className="text-center text-sm text-[#5C5C5C]">No messages yet. Say hello.</div>}
              {msgs.map(m=>(
                <div key={m.id} className={`flex ${m.from_id===user.id?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 text-sm ${m.from_id===user.id?'bg-[#1A362D] text-white':'bg-[#F7F5F0] text-[#1A1A1A]'}`}>
                    {m.body}
                    <div className={`text-[10px] mt-1 ${m.from_id===user.id?'text-white/70':'text-[#5C5C5C]'}`}>{new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
            <form onSubmit={send} className="p-3 border-t border-[#E5E1D5] flex gap-2" data-testid="message-form">
              <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type a message…" data-testid="message-input"/>
              <button className="btn-primary" data-testid="send-message-btn"><Send className="w-4 h-4"/></button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#5C5C5C] text-sm">
            {conversations.length === 0 ? 'Start a new chat from the left' : 'Select a conversation'}
          </div>
        )}
      </div>
    </div>
  );
}
