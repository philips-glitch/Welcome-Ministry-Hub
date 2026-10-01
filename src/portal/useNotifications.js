import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const POLL_MS = 60_000;

// My notifications (everyone + my group), refreshed every minute and when the tab regains focus.
export default function useNotifications() {
  const [items, setItems] = useState([]);
  const reload = useCallback(() => api.listNotifications().then(setItems).catch(() => {}), []);

  useEffect(() => {
    reload();
    const iv = setInterval(reload, POLL_MS);
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onFocus); };
  }, [reload]);

  const markRead = useCallback(async (ids) => {
    const todo = ids.filter((id) => items.find((n) => n.id === id && !n.read));
    if (!todo.length) return;
    setItems((xs) => xs.map((n) => (todo.includes(n.id) ? { ...n, read: true } : n)));
    await api.markNotificationsRead(todo).catch(() => reload());
  }, [items, reload]);

  return { items, unread: items.filter((n) => !n.read).length, reload, markRead, markAll: () => markRead(items.map((n) => n.id)) };
}
