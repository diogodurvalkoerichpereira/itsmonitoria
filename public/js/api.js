// Cliente HTTP simples para a API
let token = localStorage.getItem('its_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('its_token', t);
  else localStorage.removeItem('its_token');
}

async function req(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api' + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    location.reload();
    throw new Error('Sessão expirada');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.erro || 'Erro na requisição');
  return data;
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b),
  put: (u, b) => req('PUT', u, b),
  del: (u) => req('DELETE', u),
};
