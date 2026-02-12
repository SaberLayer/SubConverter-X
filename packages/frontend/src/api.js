const API_BASE = '/api';
export async function convert(req) {
    const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    const text = await res.text();
    if (!text)
        throw new Error('服务器返回空响应，请检查后端是否正常运行');
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`服务器返回非 JSON 响应: ${text.substring(0, 200)}`);
    }
    if (!res.ok)
        throw new Error(data.error || 'Convert failed');
    return data;
}
export async function shorten(req) {
    const res = await fetch(`${API_BASE}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    const text = await res.text();
    if (!text)
        throw new Error('服务器返回空响应，请检查后端是否正常运行');
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`服务器返回非 JSON 响应: ${text.substring(0, 200)}`);
    }
    if (!res.ok)
        throw new Error(data.error || 'Shorten failed');
    return data;
}
export async function getFormats() {
    const res = await fetch(`${API_BASE}/convert/formats`);
    const data = await res.json();
    return data.formats;
}
export async function getRules() {
    const res = await fetch(`${API_BASE}/convert/rules`);
    const data = await res.json();
    return data.rules;
}
