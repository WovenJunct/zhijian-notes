@echo off
setlocal
if not defined JAVA_HOME (
 echo Please set JAVA_HOME to a JDK 17 or newer installation. 1>&2
 exit /b 1
)
set "GRADLE_USER_HOME=%~dp0.toolchain\gradle-cache"
call "%~dp0.toolchain\gradle-8.13\bin\gradle.bat" %*
