import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const REPO_OWNER = 'AntPac432';
const REPO_NAME = 'Apothic';
const BASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const githubHeaders = { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
async function getFileSha(path, branch = 'main') { const res = await fetch(`${BASE_URL}/contents/${path}?ref=${branch}`, { headers: githubHeaders }); if (res.status === 404) return null; const data = await res.json(); return data.sha || null; }
async function pushFile(path, content, message, branch = 'main') { const sha = await getFileSha(path, branch); const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch }; if (sha) body.sha = sha; const res = await fetch(`${BASE_URL}/contents/${path}`, { method: 'PUT', headers: githubHeaders, body: JSON.stringify(body) }); return await res.json(); }
async function getCommits(perPage = 20) { const res = await fetch(`${BASE_URL}/commits?per_page=${perPage}`, { headers: githubHeaders }); return await res.json(); }
async function getRepoInfo() { const res = await fetch(BASE_URL, { headers: githubHeaders }); return await res.json(); }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { action, path, content, message, branch, branchName, fromBranch, perPage, sha } = await req.json();
    let result;
    switch (action) {
      case 'push_file': result = await pushFile(path, content, message || `chore: update ${path}`, branch || 'main'); break;
      case 'get_commits': result = await getCommits(perPage || 20); break;
      case 'get_repo_info': result = await getRepoInfo(); break;
      case 'get_file_sha': result = { sha: await getFileSha(path, branch || 'main') }; break;
      case 'get_commit_diff': { const commitRes = await fetch(`${BASE_URL}/commits/${sha}`, { headers: githubHeaders }); const commitData = await commitRes.json(); result = { sha: commitData.sha, files: (commitData.files || []).map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch?.slice(0, 2000) || null })) }; break; }
      case 'list_files': { const dirPath = path || 'Source/Apothic'; const res = await fetch(`${BASE_URL}/contents/${dirPath}?ref=${branch || 'main'}`, { headers: githubHeaders }); const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Failed to list files'); result = Array.isArray(data) ? data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size, sha: f.sha })) : []; break; }
      default: return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    return Response.json({ ok: true, result });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
