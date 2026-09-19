import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env };
const localTools = path.join(root, 'tmp', 'android-tools');
const localJava = path.join(localTools, 'java');
const localSdk = path.join(localTools, 'sdk');

// Prefer the optional project-local toolchain without changing system settings.
if (existsSync(localJava)) {
  const jdk = readdirSync(localJava).find(name =>
    existsSync(path.join(localJava, name, 'bin', 'java.exe')));
  if (jdk) env.JAVA_HOME = path.join(localJava, jdk);
}
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && existsSync(localSdk)) {
  env.ANDROID_HOME = localSdk;
}
env.GRADLE_USER_HOME ??= path.join(root, '.gradle');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], root);
if (process.platform === 'win32') {
  run(env.ComSpec || 'cmd.exe', ['/d', '/c', '.\\gradlew.bat', 'assembleDebug', '--no-daemon'], path.join(root, 'android'));
} else {
  run('sh', ['./gradlew', 'assembleDebug', '--no-daemon'], path.join(root, 'android'));
}
console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk');
