import { platform } from '@tauri-apps/plugin-os';

export const currentPlatform = platform();
export const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';
export const isDesktop = !isMobile;
export const isLinux = currentPlatform === 'linux';
export const isWindows = currentPlatform === 'windows';
