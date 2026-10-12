import { useEffect, useRef, useState } from 'react';
import { desktop } from './files';

export function sameFilePath(first?: string, second?: string) {
  if (!first || !second) return false;
  const normalize = (path: string) => {
    const clean = path.replace(/^\\\\\?\\/, '').replaceAll('\\', '/');
    return /^[a-z]:\//i.test(clean) || clean.startsWith('//') ? clean.toLowerCase() : clean;
  };
  return normalize(first) === normalize(second);
}

// Register before draining the native queue, so both cold launch and Finder /
// Explorer opens reach the same queue even while a save or export is running.
export function useExternalFiles(onError: (message: string) => void) {
  const paths = useRef<string[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const drain = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const incoming = await invoke<string[]>('take_pending_files');
        for (const path of incoming) if (!paths.current.some(item => sameFilePath(item, path))) paths.current.push(path);
        if (incoming.length) setRevision(value => value + 1);
      } catch (error) { onError(`接收文稿失败：${String(error)}`); }
    };
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      if (cancelled) return;
      const stop = await listen('chartelis-open-files', () => void drain());
      if (cancelled) { stop(); return; }
      unlisten = stop;
      await drain();
    }).catch(error => onError(`文件关联初始化失败：${String(error)}`));
    return () => { cancelled = true; unlisten?.(); };
  }, [onError]);
  return { paths, revision };
}
