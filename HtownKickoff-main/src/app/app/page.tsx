import type { Metadata } from 'next';
import HighlightStudio from '../../components/stream/HighlightStudio';
export const metadata: Metadata = {
  title: 'Highlight Studio',
  description: 'Turn your match footage into a shareable sports highlight reel.',
};
export default function Page() { return <HighlightStudio />; }
