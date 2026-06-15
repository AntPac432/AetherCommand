const BASE_URL = `https://api.github.com/repos/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`;
const ghHeaders = () => ({ 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' });

async function getFileSha(path, branch = 'main') {
  const res = await fetch(`${BASE_URL}/contents/${path}?ref=${branch}`, { headers: ghHeaders() });
  if (res.status === 404) return null;
  return (await res.json()).sha || null;
}

export async function githubOps({ action, path, content, message, branch, perPage, sha }) {
  switch (action) {
    case 'push_file': {
      const fileSha = await getFileSha(path, branch || 'main');
      const body = { message: message || `chore: update ${path}`, content: Buffer.from(content).toString('base64'), branch: branch || 'main' };
      if (fileSha) body.sha = fileSha;
      const res = await fetch(`${BASE_URL}/contents/${path}`, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
      return { ok: res.ok, result: await res.json() };
    }
    case 'get_commits': {
      const res = await fetch(`${BASE_URL}/commits?per_page=${perPage || 20}`, { headers: ghHeaders() });
      return { ok: true, result: await res.json() };
    }
    case 'get_repo_info': {
      const res = await fetch(BASE_URL, { headers: ghHeaders() });
      return { ok: true, result: await res.json() };
    }
    case 'get_file_sha': {
      return { ok: true, result: { sha: await getFileSha(path, branch || 'main') } };
    }
    case 'get_commit_diff': {
      const res = await fetch(`${BASE_URL}/commits/${sha}`, { headers: ghHeaders() });
      const data = await res.json();
      return { ok: true, result: { sha: data.sha, files: (data.files || []).map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch?.slice(0, 2000) })) } };
    }
    case 'list_files': {
      const dirPath = path || 'Source/Apothic';
      const res = await fetch(`${BASE_URL}/contents/${dirPath}?ref=${branch || 'main'}`, { headers: ghHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'list_files failed');
      return { ok: true, result: Array.isArray(data) ? data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size, sha: f.sha })) : [] };
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}
