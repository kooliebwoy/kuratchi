@echo off
setlocal

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "CRATE_DIR=%ROOT%\host\rust\desktop-host"
set "OUT_DIR=%ROOT%\out\windows-host"
set "TARGET_DIR=%ROOT%\out\cargo-target"
set "RUST_TARGET=aarch64-pc-windows-msvc"
set "SOURCE_EXE=%TARGET_DIR%\%RUST_TARGET%\release\workerd-desktop-host.exe"
set "OUT_EXE=%OUT_DIR%\workerd-desktop-host.exe"
set "SDK_LIB_DIR=C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\arm64"
set "SDK_SHIM_DIR=%ROOT%\out\windows-sdk-shim\arm64"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"

if not exist "%CRATE_DIR%\Cargo.toml" (
  echo [workerd-desktop-host] Missing Rust host manifest at "%CRATE_DIR%\Cargo.toml"
  exit /b 1
)

if not exist "%VSWHERE%" (
  echo [workerd-desktop-host] Could not find vswhere.exe
  exit /b 1
)

for /f "usebackq delims=" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.ARM64 -find VC\Auxiliary\Build\vcvarsarm64.bat`) do set "VCVARS=%%I"
if not defined VCVARS (
  for /f "usebackq delims=" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find VC\Auxiliary\Build\vcvarsarm64.bat`) do set "VCVARS=%%I"
)
if not defined VCVARS (
  echo [workerd-desktop-host] Could not locate vcvarsarm64.bat
  exit /b 1
)

if not exist "%SDK_LIB_DIR%\WindowsApp.lib" (
  echo [workerd-desktop-host] Missing WindowsApp.lib at "%SDK_LIB_DIR%\WindowsApp.lib"
  exit /b 1
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%SDK_SHIM_DIR%" mkdir "%SDK_SHIM_DIR%"
copy /Y "%SDK_LIB_DIR%\WindowsApp.lib" "%SDK_SHIM_DIR%\windows.lib" >nul

call "%VCVARS%" >nul
if errorlevel 1 exit /b 1

set "LIB=%SDK_SHIM_DIR%;%LIB%"
set "CARGO_TARGET_DIR=%TARGET_DIR%"
cargo build --manifest-path "%CRATE_DIR%\Cargo.toml" --release --target %RUST_TARGET%
if errorlevel 1 exit /b %ERRORLEVEL%

copy /Y "%SOURCE_EXE%" "%OUT_EXE%" >nul
if errorlevel 1 (
  echo [workerd-desktop-host] warning: could not copy host binary to "%OUT_EXE%" because it is likely in use. Using Cargo target output directly.
)

exit /b 0

