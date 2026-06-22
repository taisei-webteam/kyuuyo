/**
 * Renderer 側で window.api の型を認識するための型定義
 */
import type { ElectronApi } from '../preload/index.js';

declare global {
  interface Window {
    api: ElectronApi;
  }
}
