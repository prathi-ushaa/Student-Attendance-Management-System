let token = localStorage.getItem('token') || '';

export const setToken = (t) => {
  token = t;
  t ? localStorage.setItem('token', t) : localStorage.removeItem('token');
};

export async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
