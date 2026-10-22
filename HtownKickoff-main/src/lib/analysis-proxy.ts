/** Same playback timeline, smaller analysis copy; export still uses the original. */
export function analysisProxyArgs(source: string, output: string): string[] {
  return ['-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-i', source,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', 'fps=24,scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=max(iw\\,400):max(ih\\,400):(ow-iw)/2:(oh-ih)/2,setsar=1',
    '-c:v', 'libx264', '-threads', '1', '-preset', 'ultrafast', '-crf', '28',
    '-maxrate', '900k', '-bufsize', '1800k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k',
    '-movflags', '+faststart', output];
}
