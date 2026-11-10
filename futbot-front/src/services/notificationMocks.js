const MOCK_NOTIFICATIONS = [
  {
    id: 3,
    kind: 'leagueFinished',
    leagueId: 2,
    leagueMatchId: null,
    seen: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    leagueName: 'Copa del barrio #2',
  },
  {
    id: 2,
    kind: 'matchFinished',
    leagueId: 2,
    leagueMatchId: 101,
    seen: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    club1: { id: 1, username: 'pepe', name: 'Boca Juniors FC', avatar: 1 },
    club2: { id: 2, username: 'luli', name: 'River Plate FC',  avatar: 2 },
    result: { score1: 2, score2: 1, penalties: null },
  },
  {
    id: 1,
    kind: 'matchFinished',
    leagueId: 2,
    leagueMatchId: 102,
    seen: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    club1: { id: 3, username: 'nico', name: 'Racing Club',   avatar: 3 },
    club2: { id: 4, username: 'sofi', name: 'Independiente', avatar: 4 },
    result: { score1: 0, score2: 0, penalties: { score1: 4, score2: 3, winner: 'club1' } },
  },
];

export async function markNotificationsSeenMock(_notificationId) {
  await new Promise((r) => setTimeout(r, 200));
}

export function openNotificationsSocketMock() {
  const socket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    close() { clearTimeout(timer); },
  };

  const timer = setTimeout(() => {
    socket.onopen?.();
    setTimeout(() => {
      socket.onmessage?.({
        data: JSON.stringify({
          type: 'notifications',
          new: true,
          notifications: MOCK_NOTIFICATIONS,
        }),
      });
    }, 200);
  }, 100);

  return socket;
}
