import { describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ default: { post: vi.fn(), defaults: { baseURL: 'http://localhost:8000' } } }));
vi.mock('../config/mocks', () => ({ USE_MOCKS: false }));
vi.mock('./matchService', () => ({ resolveWsBase: (base) => base.replace(/^http/, 'ws') }));

import api from './api';
import {
  buildTestWsUrl,
  createBehaviorTestConnection,
  mapTestFieldErrors,
} from './behaviorTestService';

describe('mapTestFieldErrors', () => {
  it('mapea cada campo de members[i] a su fila y un reason por campo', () => {
    expect(
      mapTestFieldErrors([
        { field: 'members[0].playerId', reason: 'required' },
        { field: 'members[2].behaviorId', reason: 'outOfRange' },
        { field: 'members[0].playerId', reason: 'invalidType' },
      ]),
    ).toEqual({
      'members.0.playerId': 'Completá este campo.',
      'members.2.behaviorId': 'Valor fuera de rango.',
    });
  });

  it('members / invalidTeam queda como error general', () => {
    const errors = mapTestFieldErrors([{ field: 'members', reason: 'invalidTeam' }]);
    expect(errors.members).toMatch(/delantero, un mediocampista y un defensor/);
  });

  it('un elemento que no es objeto (members[i]) se muestra en el jugador de esa fila', () => {
    expect(mapTestFieldErrors([{ field: 'members[3]', reason: 'invalidType' }])).toEqual({
      'members.3.playerId': 'Valor inválido.',
    });
  });
});

describe('createBehaviorTestConnection / buildTestWsUrl', () => {
  it('hace POST /behaviors/{id}/test-connections con { members }', async () => {
    const members = [{ playerId: 1, club: 'club1', role: 'forward', behaviorId: 7 }];
    api.post.mockResolvedValue({ data: { tokenWs: 'abc' } });

    await expect(createBehaviorTestConnection(7, members)).resolves.toEqual({ tokenWs: 'abc' });
    expect(api.post).toHaveBeenCalledWith('/behaviors/7/test-connections', { members }, expect.anything());
  });

  it('arma la URL del canal de prueba con el id del behavior y el token', () => {
    expect(buildTestWsUrl(7, 'a b')).toBe('ws://localhost:8000/ws/behaviors/7/test?token=a%20b');
  });
});
