import { NextResponse } from 'next/server';
import { analyzeText } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json({ error: 'Text exceeds 50,000 character limit' }, { status: 400 });
    }

    const result = await analyzeText(text);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to analyze text';
    console.error('Detection error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
