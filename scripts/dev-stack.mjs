import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs `dev-stack.sh` through a shell that can actually run it.
 *
 * On Windows, `bash` on PATH is usually `C:\Windows\System32\bash.exe` — the WSL launcher. With no
 * distro installed it fails with `execvpe(/bin/bash) failed: No such file or directory`, which
 * reads like a broken script rather than the wrong interpreter. Git ships a real bash, and every
 * checkout of this repository has git, so it is always there to be found.
 *
 * The npm scripts point here rather than at `bash` so that `npm run dev` behaves the same from
 * PowerShell, cmd, and Git Bash.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'dev-stack.sh');

/** WSL's launcher and its Store alias, neither of which can run a script from this filesystem. */
function isWindowsShim(candidate) {
  const lower = candidate.toLowerCase();
  return lower.includes(`${sep}system32${sep}`) || lower.includes(`${sep}windowsapps${sep}`);
}

/** Git Bash sits beside the git executable: <install>/cmd/git.exe -> <install>/bin/bash.exe. */
function bashBesideGit() {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['git'], {
    encoding: 'utf8',
  });
  if (probe.status !== 0 || typeof probe.stdout !== 'string') return null;

  for (const line of probe.stdout.split(/\r?\n/)) {
    const gitPath = line.trim();
    if (gitPath === '') continue;
    // <install>/cmd/git.exe and <install>/bin/git.exe both resolve to <install>.
    const installRoot = resolve(dirname(gitPath), '..');
    const candidate = join(installRoot, 'bin', 'bash.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveBash() {
  const override = process.env.GI_BASH;
  if (override !== undefined && override !== '') {
    if (!existsSync(override)) throw new Error(`GI_BASH is set to ${override}, which does not exist`);
    return override;
  }

  if (process.platform !== 'win32') return 'bash';

  const fromGit = bashBesideGit();
  if (fromGit !== null) return fromGit;

  const known = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ];
  for (const candidate of known) {
    if (candidate !== '' && existsSync(candidate)) return candidate;
  }

  // Last resort: whatever is on PATH, but only if it is not one of the WSL shims — running those
  // produces an error about /bin/bash that has nothing to do with this repository.
  const onPath = spawnSync('where', ['bash'], { encoding: 'utf8' });
  if (onPath.status === 0 && typeof onPath.stdout === 'string') {
    for (const line of onPath.stdout.split(/\r?\n/)) {
      const candidate = line.trim();
      if (candidate !== '' && !isWindowsShim(candidate)) return candidate;
    }
  }

  throw new Error(
    'No usable bash found. Git for Windows ships one; install it, or set GI_BASH to a bash.exe.\n' +
      'The bash on PATH is the WSL launcher, which cannot run this script.',
  );
}

let bash;
try {
  bash = resolveBash();
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

const result = spawnSync(bash, [SCRIPT, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error !== undefined) {
  console.error(`Could not run ${bash}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
