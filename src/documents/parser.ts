import { AttachedFile } from '../types';

export class DocumentParser {
  /**
   * Reads an uploaded File object and extracts text and metadata.
   */
  static async parseFile(file: File): Promise<AttachedFile> {
    const id = 'att_' + Math.random().toString(36).substring(2, 11);
    const name = file.name;
    const size = file.size;
    const type = file.type || 'text/plain';

    // If text-like (txt, md, csv, json, js, ts, html, py, etc.)
    if (
      type.startsWith('text/') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      name.endsWith('.ts') ||
      name.endsWith('.js') ||
      name.endsWith('.py') ||
      name.endsWith('.html') ||
      name.endsWith('.css')
    ) {
      const text = await file.text();
      return {
        id,
        name,
        size,
        type,
        content: text,
        extractedText: text,
      };
    }

    // If PDF
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const extracted = await this.extractTextFromPdfBuffer(arrayBuffer);
      return {
        id,
        name,
        size,
        type: 'application/pdf',
        content: `[PDF File: ${name}, ${size} bytes]`,
        extractedText: extracted,
      };
    }

    // Default: try reading text, otherwise fallback
    try {
      const text = await file.text();
      return {
        id,
        name,
        size,
        type,
        content: text,
        extractedText: text,
      };
    } catch {
      return {
        id,
        name,
        size,
        type,
        content: `[Binary File: ${name}]`,
        extractedText: `[Binary content cannot be previewed directly]`,
      };
    }
  }

  /**
   * Simple client-side text extractor for PDF byte streams
   */
  private static async extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(uint8);

    // Regex extraction of text in parentheses (PDF standard text chunks e.g. (Hello) Tj or [(H)(e)(l)(l)(o)] TJ)
    const textMatches: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*T[jJ]/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].length > 1) {
        textMatches.push(match[1]);
      }
    }

    // Also look for Stream text
    if (textMatches.length < 5) {
      const streamRegex = /BT[\s\S]*?ET/g;
      let sMatch;
      while ((sMatch = streamRegex.exec(raw)) !== null) {
        const cleaned = sMatch[0]
          .replace(/[\\/()[\]]/g, ' ')
          .replace(/[0-9.]+\s+[0-9.]+\s+Td/g, '\n')
          .trim();
        if (cleaned) textMatches.push(cleaned);
      }
    }

    if (textMatches.length > 0) {
      return textMatches.join(' ').replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
    }

    return `[PDF text extraction completed. Document length: ${buffer.byteLength} bytes]`;
  }

  /**
   * Split document into bounded context chunks
   */
  static chunkText(text: string, maxChunkSize = 1200): string[] {
    if (!text) return [];
    if (text.length <= maxChunkSize) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
