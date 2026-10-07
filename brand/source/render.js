// Headless Edge renderer. Usage: node render.js jobs.json   (jobs: [{kind:'png'|'pdf'|'dom', html, out, w, h, dsf, t}])
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), url = require('url');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PROFILE = path.join(require('os').tmpdir(), 'hemlo-edge-profile');
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const j of jobs) {
  const src = url.pathToFileURL(j.html).href;
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${PROFILE}`, `--virtual-time-budget=${j.budget || 6000}`, '--run-all-compositor-stages-before-draw'];
  if (j.kind === 'png') {
    args.push(`--window-size=${j.w},${j.h}`, `--force-device-scale-factor=${j.dsf || 1}`, `--screenshot=${j.out}`);
    if (j.t) args.push('--default-background-color=00000000');
  } else if (j.kind === 'pdf') {
    args.push(`--print-to-pdf=${j.out}`, '--no-pdf-header-footer', '--print-to-pdf-no-header');
  } else if (j.kind === 'dom') args.push('--dump-dom');
  args.push(src);
  try { fs.unlinkSync(j.out); } catch {}
  const r = spawnSync(EDGE, args, { timeout: 90000, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (j.kind === 'dom') fs.writeFileSync(j.out, r.stdout || '');
  const ok = fs.existsSync(j.out) && fs.statSync(j.out).size > 0;
  console.log((ok ? 'ok   ' : 'FAIL ') + path.basename(j.out) + (r.error ? ' ' + r.error.code : ''));
}
