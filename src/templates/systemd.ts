interface SystemdOptions {
  nodePath: string;
  scriptPath: string;
  intervalSeconds: number;
}

export function generateServiceUnit(opts: SystemdOptions): string {
  return `[Unit]
Description=git-syncr - Sync git repos with remotes

[Service]
Type=oneshot
ExecStart=${opts.nodePath} ${opts.scriptPath}
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
`;
}

export function generateTimerUnit(opts: SystemdOptions): string {
  return `[Unit]
Description=git-syncr timer - Run git-syncr periodically

[Timer]
OnBootSec=5min
OnUnitActiveSec=${opts.intervalSeconds}s
Persistent=true

[Install]
WantedBy=timers.target
`;
}
