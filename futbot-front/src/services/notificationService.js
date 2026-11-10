import api from './api';
import { markNotificationsSeenMock, openNotificationsSocketMock } from './notificationMocks';
import { USE_MOCKS } from '../config/mocks';
import { resolveWsBase } from './matchService';

function buildNotificationsWsUrl() {
  const base = resolveWsBase(import.meta.env.VITE_WS_URL || api.defaults.baseURL);
  return `${base}/ws/notifications`;
}

export async function markNotificationsSeen(notificationId) {
  if (USE_MOCKS) return markNotificationsSeenMock(notificationId);
  await api.post('/notifications/seen', { notificationId });
}

export function openNotificationsSocket() {
  if (USE_MOCKS) return openNotificationsSocketMock();
  return new WebSocket(buildNotificationsWsUrl());
}
