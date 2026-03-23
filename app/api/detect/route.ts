import { NextResponse } from 'next/server';
import { analyzeText } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const result = await analyzeText(text);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze text' }, { status: 500 });
  }
}
