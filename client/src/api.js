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
    // Sessao invalida/expirada: limpa o token e avisa a aplicacao para
    // voltar ao login. NUNCA recarregar aqui (causa loop de reload).
    setToken(null);
    window.dispatchEvent(new CustomEvent('its:sessao-expirada'));
    throw new Error('Sessão expirada');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.erro || 'Erro na requisição');
  return data;
}

// upload de arquivos (multipart) - nao define Content-Type (o browser cuida do boundary)
async function uploadReq(url, formData) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api' + url, { method: 'POST', headers, body: formData });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('its:sessao-expirada'));
    throw new Error('Sessão expirada');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.erro || 'Erro no upload');
  return data;
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b),
  put: (u, b) => req('PUT', u, b),
  del: (u) => req('DELETE', u),
  delete: (u) => req('DELETE', u),
  upload: uploadReq,
};
