#!/usr/bin/env node
/*
  Fills in "fullQualitySize" for every project in projects.json that has a
  fullQualityUrl, by asking the host directly how big the file is — no
  manual typing needed.

  USAGE
    Put this file next to projects.json and run, locally (needs real
    internet access — this can't run inside the browser, and it can't run
    in the sandbox that built this site either):

        node fetch-video-sizes.js

    Needs Node 18 or newer (for the built-in fetch). Run it again any time
    you add or change a fullQualityUrl.

  COVERAGE
    Dropbox links   — reliable. A HEAD request reports the exact byte size
                       via the Content-Length header, no auth needed.

    Google Drive     — needs the Drive API, because Drive doesn't expose
    links             file size to a plain HEAD request the way Dropbox
                       does. Skipped automatically UNLESS you set a
                       DRIVE_API_KEY environment variable (a free,
                       read-only API key from Google Cloud Console — ask if
                       you'd like help getting one). With that key set,
                       these are fetched too:

                           DRIVE_API_KEY=xxxxx node fetch-video-sizes.js

                       Only works for files shared "Anyone with the link",
                       which yours already are.

    Anything else     best-effort HEAD request, same as Dropbox.
    (self-hosted
    .mp4 etc.)

  It only ever writes fullQualitySize — nothing else in projects.json is
  touched, but note the file does get re-saved with consistent two-space
  JSON formatting.
*/

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'projects.json');
const DRIVE_API_KEY = process.env.DRIVE_API_KEY || '';

// Same dl=0/dl=1 -> raw=1 swap script.js uses at runtime, so this checks
// the exact URL a visitor's browser will actually download.
function dropboxRaw(url) {
  if (!/dropbox\.com\//.test(url)) return url;
  const noDl = url.replace(/[?&]dl=[01]\b/g, '');
  if (/[?&]raw=1\b/.test(noDl)) return noDl;
  return noDl + (noDl.includes('?') ? '&' : '?') + 'raw=1';
}

function driveFileId(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
  return m ? m[1] : null;
}

function humanSize(bytes) {
  if (!bytes || !isFinite(bytes)) return null;
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return (Math.round(gb * 10) / 10) + 'GB';
  const mb = bytes / 1024 ** 2;
  return Math.round(mb) + 'MB';
}

// A HEAD request is the cheap first try, but some CDNs (Dropbox's included,
// apparently — see the sandbox test run) answer HEAD without a
// Content-Length at all. When that happens, fall back to asking for just
// the first KB with a Range GET: a server that honours ranges reports the
// *total* size in the Content-Range response header ("bytes 0-1023/N"),
// and the body is cancelled immediately after so the rest of the file is
// never actually downloaded.
async function bytesFromHead(url) {
  const res = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  const len = res.headers.get('content-length');
  return { bytes: len ? parseInt(len, 10) : null, status: res.status };
}

async function bytesFromRangedGet(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { Range: 'bytes=0-1023' },
    signal: AbortSignal.timeout(20000)
  });

  let bytes = null;
  const range = res.headers.get('content-range'); // "bytes 0-1023/358400000"
  const total = range && range.match(/\/(\d+)\s*$/);
  if (total) {
    bytes = parseInt(total[1], 10);
  } else if (res.status === 200) {
    // Server ignored the Range header and sent the whole thing — its
    // Content-Length is then the full file size, not just 1KB.
    const len = res.headers.get('content-length');
    if (len) bytes = parseInt(len, 10);
  }

  // Don't let Node keep downloading a multi-hundred-MB body just because
  // we already have what we need from the headers.
  if (res.body) {
    try { await res.body.cancel(); } catch (_) { /* already closed */ }
  }

  return { bytes: bytes, status: res.status };
}

async function bestEffortSize(url, label) {
  try {
    const head = await bytesFromHead(url);
    if (head.bytes) return head.bytes;
    console.warn(label + ': HEAD gave HTTP ' + head.status + ' with no size — trying a ranged request instead');
  } catch (err) {
    console.warn(label + ': HEAD failed (' + err.message + ') — trying a ranged request instead');
  }

  try {
    const ranged = await bytesFromRangedGet(url);
    if (ranged.bytes) return ranged.bytes;
    console.warn(label + ': ranged request gave HTTP ' + ranged.status + ' with no size either');
  } catch (err) {
    console.warn(label + ': ranged request failed (' + err.message + ')');
  }

  return null;
}

async function driveApiSize(fileId) {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files/' + fileId +
    '?fields=size&key=' + DRIVE_API_KEY,
    { signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) throw new Error('Drive API HTTP ' + res.status);
  const data = await res.json();
  return data.size ? parseInt(data.size, 10) : null;
}

async function sizeFor(project) {
  const url = project.fullQualityUrl;
  const label = project.title;

  if (/dropbox\.com\//.test(url)) {
    return bestEffortSize(dropboxRaw(url), label);
  }

  const id = driveFileId(url);
  if (id) {
    if (!DRIVE_API_KEY) {
      console.warn(label + ': Drive-hosted — set DRIVE_API_KEY to auto-fetch this one, skipped for now');
      return null;
    }
    return driveApiSize(id);
  }

  // Anything else: same best-effort approach as Dropbox.
  return bestEffortSize(url, label);
}

async function main() {
  const projects = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let changed = false;

  for (const project of projects) {
    if (!project.fullQualityUrl) continue;

    try {
      const bytes = await sizeFor(project);
      const size = humanSize(bytes);

      if (!size) {
        console.warn(project.title + ': could not determine a size — left as-is');
        continue;
      }

      console.log(project.title + ': ' + size);
      if (project.fullQualitySize !== size) {
        project.fullQualitySize = size;
        changed = true;
      }
    } catch (err) {
      console.warn(project.title + ': request failed (' + err.message + ') — left as-is');
    }
  }

  if (changed) {
    fs.writeFileSync(FILE, JSON.stringify(projects, null, 2) + '\n');
    console.log('\nprojects.json updated.');
  } else {
    console.log('\nNothing changed.');
  }
}

main();
