import axios from 'axios';

const MOCK_DELAY_MS = 300;

export const MOCK_PLAYERS = [
  { id: 1, name: 'Lionel Messi' },
  { id: 2, name: 'Julián Álvarez' },
  { id: 3, name: 'Rodrigo De Paul' },
  { id: 4, name: 'Alexis Mac Allister' },
  { id: 5, name: 'Cristian Romero' },
  { id: 6, name: 'Emiliano Martínez' },
  { id: 7, name: 'Lautaro Martínez' },
  { id: 8, name: 'Enzo Fernández' },
];

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new axios.CanceledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new axios.CanceledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export async function getPlayersMock(page = 1, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);
  return [...MOCK_PLAYERS];
}
