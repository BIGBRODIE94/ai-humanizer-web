import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';

    // Handle PDF extraction
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // @ts-ignore
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } 
    // Handle DOCX extraction
    else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.name.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } 
    // Handle plain text files
    else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } 
    else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.' }, 
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract any text from the file. The file might be empty, scanned, or protected.' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText.trim() });

  } catch (error: any) {
    console.error('File extraction error:', error);
    return NextResponse.json({ error: error.message || 'Failed to extract text from file' }, { status: 500 });
  }
}
