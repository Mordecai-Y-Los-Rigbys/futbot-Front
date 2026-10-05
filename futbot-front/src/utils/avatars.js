// Carga lo que haya en src/assets/avatars/avatar-N.(png|webp|svg|jpg).
// Con import.meta.glob, si la carpeta está vacía no rompe el build: devuelve null
// y la UI muestra una inicial en su lugar.
const files = import.meta.glob('../assets/avatars/*.webp', {
  eager: true,
  import: 'default',
});

const AVATARS = {};
for (const [path, url] of Object.entries(files)) {
  const match = path.match(/avatar-(\d+)\./);
  if (match) AVATARS[Number(match[1])] = url;
}

export const getAvatarSrc = (n) => AVATARS[Number(n)] ?? null;