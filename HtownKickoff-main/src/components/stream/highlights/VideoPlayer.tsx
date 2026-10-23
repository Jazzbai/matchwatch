'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type VideoPlayerHandle = { seek: (seconds: number) => void; currentTime: () => number };
type Props = { src: string | null; onDuration?: (seconds: number) => void; onError?: (message: string) => void };

/** Plays MP4 files and HLS streams (via hls.js where the browser lacks native HLS). */
const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer({ src, onDuration, onError }, ref) {
  const video = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seek(seconds) {
      const element = video.current;
      if (!element) return;
      element.currentTime = seconds;
      void element.play().catch(() => {});
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    currentTime: () => video.current?.currentTime ?? 0,
  }), []);

  useEffect(() => {
    const element = video.current;
    if (!element || !src) return;
    const isHls = /\.m3u8(\?|$)/.test(src);
    if (!isHls || element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = src;
      return () => { element.removeAttribute('src'); element.load(); };
    }
    let destroyed = false, player: { destroy: () => void } | null = null;
    void import('hls.js').then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) { onError?.('This browser cannot play the match stream.'); return; }
      const hls = new Hls({ maxBufferLength: 20 });
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) onError?.('The match stream could not be loaded.'); });
      hls.loadSource(src);
      hls.attachMedia(element);
      player = hls;
    });
    return () => { destroyed = true; player?.destroy(); };
  }, [src, onError]);

  if (!src) return null;
  return <video ref={video} controls preload="metadata" playsInline
    onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds)) onDuration?.(seconds); }} />;
});

export default VideoPlayer;
