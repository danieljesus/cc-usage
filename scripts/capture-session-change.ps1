<#
.SYNOPSIS
  Reproduces the exact condition suspected in the user's bug report: the
  active-session COUNT changing while cc-usage runs (a session appearing or
  ending), which changes the frame's total height. Never touches any of the
  user's real session files — creates and removes a synthetic one, tagged
  with this script's own PID (always alive while the script runs).

  Timing note: cc-usage's readSessions() only runs inside its poll() cycle
  (app.tsx POLL_MS = 30_000ms), NOT on every 1s tick — an earlier version of
  this script waited a couple of seconds between changes and never caught
  anything, because the app simply hadn't looked at the sessions directory
  again yet. This version waits a full poll cycle (+2s buffer) after each
  change before expecting it to show up.
#>
param(
  [string]$OutDir = "$PSScriptRoot\..\capture-out\session-change"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Capture2 {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$POLL_MS = 30000
$POLL_BUFFER_S = 3

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$sessionsDir = "$env:USERPROFILE\.claude\sessions"
$fakeSessionPath = Join-Path $sessionsDir "999999999.json"

function Capture([string]$label, $proc) {
  $rect = New-Object Win32Capture2+RECT
  [Win32Capture2]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -le 0 -or $height -le 0) { Write-Host "$label : invalid rect, skip"; return }
  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
  $outPath = Join-Path $OutDir "$label.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "$label -> $outPath"
}

$marker = "CCUSAGE_SESSCHANGE_$([guid]::NewGuid().ToString('N').Substring(0,8))"
Write-Host "Launching Windows Terminal (marker: $marker)..."
Start-Process wt.exe -ArgumentList @('-w', 'new', '--title', $marker, 'powershell', '-NoExit', '-Command', 'cc-usage') | Out-Null

$proc = $null
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline -and -not $proc) {
  Start-Sleep -Milliseconds 300
  $proc = Get-Process WindowsTerminal -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "*$marker*" } | Select-Object -First 1
}
if (-not $proc) { Write-Host "FAILED: window not found."; exit 1 }

[Win32Capture2]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
[Win32Capture2]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 4
Capture "01-baseline" $proc

# This script's own PID: guaranteed alive for the script's lifetime, no real
# session is touched.
$fakePid = $PID
$fakeSession = @{
  pid = $fakePid
  cwd = "$env:USERPROFILE"
  name = "synthetic-repro-session"
  status = "working"
  statusUpdatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json

Write-Host "Adding synthetic session (pid $fakePid) to grow the frame height..."
Set-Content -Path $fakeSessionPath -Value $fakeSession -Encoding utf8
$waitAdd = [int]($POLL_MS / 1000) + $POLL_BUFFER_S
Write-Host "Waiting ${waitAdd}s for the next poll cycle to pick it up..."
Start-Sleep -Seconds $waitAdd
Capture "02-after-add" $proc

Write-Host "Removing synthetic session to shrink the frame height back..."
Remove-Item -Path $fakeSessionPath -Force -ErrorAction SilentlyContinue
$waitRemoveLead = [int]($POLL_MS / 1000) - 4
Write-Host "Waiting ${waitRemoveLead}s, then capturing tightly around the next poll..."
Start-Sleep -Seconds $waitRemoveLead
# Capture tightly around the shrink — this is the transition the user's
# report matches (session count going down mid-run).
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Milliseconds 800
  Capture ("03-after-remove-{0:D2}" -f $i) $proc
}

# WM_CLOSE to the specific window HANDLE, never Stop-Process on the PID —
# Windows Terminal can share one process across several windows (the
# "monarch" model); killing by PID risks closing windows this script never
# opened. WM_CLOSE only ever closes this one window, like clicking its X.
Write-Host "Closing capture window (handle $($proc.MainWindowHandle))..."
[Win32Capture2]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Remove-Item -Path $fakeSessionPath -Force -ErrorAction SilentlyContinue
Write-Host "Done."
