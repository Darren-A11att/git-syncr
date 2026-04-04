interface LaunchdOptions {
  nodePath: string;
  scriptPath: string;
  syncDir: string;
  logDir: string;
  home: string;
  intervalSeconds: number;
}

export function generatePlist(opts: LaunchdOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.git-syncr</string>

    <key>ProgramArguments</key>
    <array>
        <string>${opts.nodePath}</string>
        <string>${opts.scriptPath}</string>
    </array>

    <key>StartInterval</key>
    <integer>${opts.intervalSeconds}</integer>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${opts.home}</string>
    </dict>

    <key>StandardOutPath</key>
    <string>${opts.logDir}/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${opts.logDir}/launchd-stderr.log</string>

    <key>RunAtLoad</key>
    <false/>

    <key>Nice</key>
    <integer>10</integer>
</dict>
</plist>
`;
}
