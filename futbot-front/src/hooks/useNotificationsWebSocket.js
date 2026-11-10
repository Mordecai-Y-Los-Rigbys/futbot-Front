import { useCallback, useEffect, useRef, useState } from 'react';
import { openNotificationsSocket, markNotificationsSeen } from '../services/notificationService';

const MAX_RETRIES = 3;

export default function useNotificationsWebSocket(enabled) {
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);

  const socketRef   = useRef(null);
  const retriesRef  = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    unmountedRef.current = false;
    retriesRef.current = 0;

    function connect() {
      const socket = openNotificationsSocket();
      socketRef.current = socket;

      socket.onopen = () => {
        if (unmountedRef.current) return;
        retriesRef.current = 0;
      };

      socket.onmessage = (event) => {
        if (unmountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notifications') {
            setNotifications(msg.notifications ?? []);
            setHasUnread(msg.new ?? false);
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (unmountedRef.current) return;
        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.pow(2, retriesRef.current) * 1000;
          retriesRef.current += 1;
          setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      socketRef.current?.close();
    };
  }, [enabled]);

  const markAsSeen = useCallback((notificationId) => {
    setHasUnread(false);
    markNotificationsSeen(notificationId).catch(() => {});
  }, []);

  return { notifications, hasUnread, markAsSeen };
}
