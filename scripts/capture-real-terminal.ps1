<#
.SYNOPSIS
  Launches cc-usage inside a REAL Windows Terminal window and captures
  actual screen pixels of it at several points in time, as PNG files.

  This exists because every other verification method used during
  development (ink-testing-library, xterm.js, even a real ConPTY session
  rendered through xterm.js) uses a DIFFERENT text-rendering engine than
  Windows Terminal's own (DirectWrite/AtlasEngine). Those can silently
  disagree with Windows Terminal on the one thing that has caused every
  redraw bug this project has hit: how wide a specific character renders.
  This script is the only way to see what the user actually sees.

.PARAMETER OutDir
  Directory to write PNG captures into. Created if missing.

.PARAMETER Seconds
  Comma-separated list of seconds (from launch) at which to capture.
  Multiple points let a slow-to-appear corruption get caught, not just
  the first frame.
#>
param(
  [string]$OutDir = "$PSScriptRoot\..\capture-out",
  [int[]]$Seconds = @(2, 5, 15, 30)
)

Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Capture {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$marker = "CCUSAGE_CAPTURE_$([guid]::NewGuid().ToString('N').Substring(0,8))"
Write-Host "Launching Windows Terminal (marker: $marker)..."

Start-Process wt.exe -ArgumentList @('-w', 'new', '--title', $marker, 'powershell', '-NoExit', '-Command', 'cc-usage') | Out-Null

$proc = $null
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline -and -not $proc) {
  Start-Sleep -Milliseconds 300
  $proc = Get-Process WindowsTerminal -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "*$marker*" } |
    Select-Object -First 1
}

if (-not $proc) {
  Write-Host "FAILED: could not find the Windows Terminal window (marker $marker) within 10s."
  Write-Host "Windows Terminal processes currently visible:"
  Get-Process WindowsTerminal -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle | Format-Table
  exit 1
}

Write-Host "Found window: PID $($proc.Id), handle $($proc.MainWindowHandle)"
[Win32Capture]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null   # SW_RESTORE, in case minimized
[Win32Capture]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 300

$launchTime = Get-Date
foreach ($s in $Seconds) {
  $wait = $s - ((Get-Date) - $launchTime).TotalSeconds
  if ($wait -gt 0) { Start-Sleep -Seconds $wait }

  $rect = New-Object Win32Capture+RECT
  [Win32Capture]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -le 0 -or $height -le 0) {
    Write-Host "t=${s}s: window rect invalid ($width x $height), skipping"
    continue
  }

  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
  $outPath = Join-Path $OutDir "t${s}s.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "t=${s}s -> $outPath"
}

# WM_CLOSE to the specific window HANDLE, never Stop-Process on the PID:
# Windows Terminal can consolidate several windows into one shared process
# (the "monarch" model) — killing the process by PID risks closing every
# Windows Terminal window the user has open, not just this script's own.
# Posting WM_CLOSE is exactly what clicking that one window's X button does:
# it only ever closes this window, regardless of the process model.
Write-Host "Closing capture window (handle $($proc.MainWindowHandle))..."
[Win32Capture]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Write-Host "Done."
