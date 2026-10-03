import { useEffect, useState } from 'react';
import { api } from '../../../api';
import type { Friend, FriendMessage } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { FriendRow } from '../cards/FriendCard';
import { FriendChat } from '../components/FriendChat';
import { FriendEmpty } from '../components/FriendEmpty';
import { FriendProfile } from '../components/FriendProfile';

export function FriendsPage() {
  const { data: friends } = useAsync(() => api.friends(), []);
  const [sel, setSel] = useState<{ id: string; mode: 'info' | 'chat' } | null>(null);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [thread, setThread] = useState<FriendMessage[]>([]);

  useEffect(() => {
    if (!sel) return;
    let alive = true;
    api.friend(sel.id).then((f) => alive && setFriend(f));
    if (sel.mode === 'chat') api.thread(sel.id).then((t) => alive && setThread(t));
    return () => { alive = false; };
  }, [sel]);

  // polling de mensajes nuevos mientras la conversación está abierta
  useEffect(() => {
    if (sel?.mode !== 'chat') return;
    const t = setInterval(() => api.newMessages(sel.id).then((m) => m.length && setThread((th) => [...th, ...m])), 1500);
    return () => clearInterval(t);
  }, [sel]);

  const send = async (text: string) => {
    if (!sel) return;
    const msg = await api.sendMessage(sel.id, text);
    setThread((t) => [...t, msg]);
  };
  const ready = friend && sel && friend.id === sel.id;

  return (
    <section className="view" id="v-friends">
      <h2 className="h2">Amigos</h2><p className="lede">{friends ? `${friends.length} amigos` : ' '}</p>
      <div className="fwrap">
        <div className="flist">
          {friends?.map((f) => (
            <FriendRow key={f.id} f={f} selected={sel?.id === f.id} mode={sel?.mode}
              onInfo={() => setSel({ id: f.id, mode: 'info' })} onMsg={() => { setThread([]); setSel({ id: f.id, mode: 'chat' }); }} />
          ))}
        </div>
        <div className="fpanel">
          {!ready ? <FriendEmpty /> : sel.mode === 'info' ? <FriendProfile f={friend} /> : <FriendChat f={friend} messages={thread} onSend={send} />}
        </div>
      </div>
    </section>
  );
}
