"use client";
import { usePathname } from 'next/navigation';
import { DataProvider } from '../lib/data-provider';

// Streaming has its own results API; do not run the venue dashboard's background polling there.
export default function RouteDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const streamPath = pathname === '/app' || pathname === '/stream' || pathname?.startsWith('/stream/');
  const streamHost = typeof window !== 'undefined' && window.location.hostname === 'stream.matchwatch.us' &&
    (pathname === '/' || pathname === '/studio' || pathname?.startsWith('/watch/'));
  if (streamPath || streamHost) return children;
  return <DataProvider>{children}</DataProvider>;
}
