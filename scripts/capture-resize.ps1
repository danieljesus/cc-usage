<#
.SYNOPSIS
  Reproduces the OTHER leading hypothesis from this session: a real window
  resize while cc-usage is running. Launches a real Windows Terminal window,
  lets it settle, then actually resizes it (SetWindowPos) several times in a
  row, capturing tightly around each resize.
#>
param(
  [string]$OutDir = "$PSScriptRoot\..\capture-out\resize"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Resize {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Capture([string]$label, $proc) {
  $rect = New-Object Win32Resize+RECT
  [Win32Resize]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
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

$marker = "CCUSAGE_RESIZE_$([guid]::NewGuid().ToString('N').Substring(0,8))"
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

[Win32Resize]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
[Win32Resize]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 4
Capture "01-baseline" $proc

$rect0 = New-Object Win32Resize+RECT
[Win32Resize]::GetWindowRect($proc.MainWindowHandle, [ref]$rect0) | Out-Null
$x = $rect0.Left; $y = $rect0.Top
$w0 = $rect0.Right - $rect0.Left
$h0 = $rect0.Bottom - $rect0.Top

# A sequence of real resizes (narrower, wider, shorter, back to original),
# capturing right after each one — this is where a column-count race or an
# auto-wrap from a still-too-wide row would show up.
$sizes = @(
  @{ w = [int]($w0 * 0.7); h = $h0; label = "narrower" },
  @{ w = $w0;              h = $h0; label = "back-to-original" },
  @{ w = [int]($w0 * 1.4); h = $h0; label = "wider" },
  @{ w = $w0;              h = [int]($h0 * 0.7); label = "shorter" },
  @{ w = $w0;              h = $h0; label = "back-to-original-2" }
)

$i = 0
foreach ($sz in $sizes) {
  $i++
  Write-Host "Resizing to $($sz.label) ($($sz.w)x$($sz.h))..."
  [Win32Resize]::MoveWindow($proc.MainWindowHandle, $x, $y, $sz.w, $sz.h, $true) | Out-Null
  # Capture several frames right after the resize — this is the window
  # where a stale-width frame (before App re-renders) would be visible.
  for ($j = 0; $j -lt 4; $j++) {
    Start-Sleep -Milliseconds 400
    Capture ("{0:D2}-{1}-{2}" -f $i, $sz.label, $j) $proc
  }
}

Write-Host "Closing capture window (handle $($proc.MainWindowHandle))..."
[Win32Resize]::PostMessage($proc.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Write-Host "Done."
