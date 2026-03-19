import { NextResponse } from 'next/server';
import { humanizeTextAdversarial } from '@/lib/ai';

// Optional: Vercel specific setting to allow for longer execution times (Pro plan required for >10s/60s)
export const maxDuration = 60; // 60 seconds

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // We do the adversarial loop
    const result = await humanizeTextAdversarial(text);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Humanize error:', error);
    return NextResponse.json({ error: error.message || 'Failed to humanize text' }, { status: 500 });
  }
}
