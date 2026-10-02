import { http, HttpResponse } from 'msw';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const handlers = [
  http.post(`${API}/auth/log-in`, async ({ request }) => {
    const { email, password } = await request.json();

    // Simula fallo de red
    if (email === 'caido@mail.com') return HttpResponse.error();

    // Login correcto
    if (email === 'test@mail.com' && password === '1234') {
      return HttpResponse.json({ id: 1, username: 'santi', clubName: 'FC Santi' });
    }

    // Cualquier otra cosa: credenciales inválidas
    return HttpResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
  }),
];