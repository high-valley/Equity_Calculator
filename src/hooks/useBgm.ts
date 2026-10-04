import { useEffect, useRef, useState } from 'react';
import bgmUrl from '../assets/audio/bgm.mp3';

const STORAGE_KEY = 'bgmEnabled';
const VOLUME = 0.35;

function readStoredPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface BgmControls {
  enabled: boolean;
  toggle: () => void;
}

/**
 * Background music, on/off, remembered across visits. Browsers block audio
 * that starts without a user gesture, so if the stored preference is "on"
 * from a previous visit, playback resumes on the first tap/click anywhere
 * on the page rather than automatically on load.
 */
export function useBgm(): BgmControls {
  const [enabled, setEnabled] = useState(readStoredPreference);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!audioRef.current) {
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.volume = VOLUME;
    audioRef.current = audio;
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Private browsing or storage disabled: the toggle still works for this visit.
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (enabled) {
      audio.play().catch(() => undefined); // blocked until a user gesture; the listener below retries
    } else {
      audio.pause();
    }
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const resumeIfBlocked = () => {
      if (enabled && audio.paused) audio.play().catch(() => undefined);
    };
    document.addEventListener('pointerdown', resumeIfBlocked);
    return () => document.removeEventListener('pointerdown', resumeIfBlocked);
  }, [enabled]);

  // An <audio> element keeps playing when the tab is hidden or the app is sent to the
  // background (iOS home screen, app switcher, screen lock), so pause it explicitly and
  // pick back up when the page is visible again.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const sync = () => {
      if (document.visibilityState === 'hidden') audio.pause();
      else if (enabled) audio.play().catch(() => undefined);
    };
    const pauseNow = () => audio.pause();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', pauseNow);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', pauseNow);
      window.removeEventListener('pageshow', sync);
    };
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  return { enabled, toggle: () => setEnabled((v) => !v) };
}
