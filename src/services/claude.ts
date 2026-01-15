import { settingsService } from './settings';
import Anthropic from '@anthropic-ai/sdk';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 3000  // Increased from 1000ms to 3000ms
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit or overload error
      const isRateLimitError = 
        error?.status === 429 || 
        error?.statusCode === 429 ||
        error?.status === 529 ||
        error?.error?.type === 'overloaded_error' ||
        error?.error?.type === 'rate_limit_error' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('rate_limit_error') ||
        error?.message?.includes('exceed the rate limit') ||
        error?.message?.includes('Too Many Requests');
      
      if (isRateLimitError && attempt < maxRetries) {
        // Use longer delays for rate limits: 3s, 6s, 12s
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Anthropic API rate limited. Waiting ${delay}ms before retry... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors or if we've exhausted retries, throw
      throw error;
    }
  }
  
  // If we get here, we've exhausted retries
  if (lastError?.status === 529 || lastError?.error?.type === 'overloaded_error') {
    throw new Error('Anthropic servers are currently overloaded. Please try again in a few moments.');
  }
  if (lastError?.status === 429 || lastError?.error?.type === 'rate_limit_error') {
    throw new Error('Rate limit exceeded. Please wait a minute before trying again, or use a smaller PDF.');
  }
  
  throw lastError;
}

export async function rewriteEmailBlurb(rawBlurb: string, model: 'sonnet' | 'haiku' = 'sonnet', customInstructions?: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  // Use custom instructions from parameter, fallback to settings, then default
  const prompt = customInstructions || settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  // Send instructions as system prompt and the user blurb as a separate message
  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 800,
      system: prompt,
      messages: [
        { role: 'user', content: [{ type: 'text', text: rawBlurb || '' }] }
      ],
      temperature: 0.7
    });
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

export async function rewriteEmailBlurbStream(
  rawBlurb: string, 
  model: 'sonnet' | 'haiku' = 'sonnet', 
  customInstructions: string | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  // Use custom instructions from parameter, fallback to settings, then default
  const prompt = customInstructions || settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  return await retryWithBackoff(async () => {
    const stream = await client.messages.stream({
      model: modelName,
      max_tokens: 800,
      system: prompt,
      messages: [
        { role: 'user', content: [{ type: 'text', text: rawBlurb || '' }] }
      ],
      temperature: 0.7
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text);
      }
    }
  });
}

export async function extractDocumentInsights(documentText: string, fileName: string, model: 'sonnet' | 'haiku' = 'sonnet'): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== CLAUDE SERVICE ===');
  console.log('Model:', model);
  console.log('Input documentText length:', documentText.length);
  console.log('Input documentText preview:', documentText.substring(0, 300));

  // Check if this is a custom prompt (contains instructions + "Document to analyze:")
  const isCustomPrompt = documentText.includes('Document to analyze:') && 
                        (documentText.includes('extract') || 
                         documentText.includes('analyze') || 
                         documentText.includes('table') ||
                         documentText.includes('Custom Instructions:') ||
                         documentText.includes('IMPORTANT:'));

  console.log('Is custom prompt:', isCustomPrompt);

  let messageContent: string;

  if (isCustomPrompt) {
    // This is already a formatted prompt with custom instructions, use it directly
    console.log('Using custom prompt directly');
    
    // Check if this is a table-related request and enhance the prompt
    const isTableRequest = documentText.toLowerCase().includes('table') || 
                          documentText.toLowerCase().includes('spreadsheet') || 
                          documentText.toLowerCase().includes('extract data') ||
                          documentText.toLowerCase().includes('convert');
                          
    if (isTableRequest && !documentText.includes('IMPORTANT: When presenting tabular data')) {
      // Add table formatting instructions if not already present
      messageContent = documentText + `

ADDITIONAL INSTRUCTION: If your response contains structured data, present it as a proper markdown table using | symbols for columns and --- for separators. Example:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |`;
    } else {
      messageContent = documentText;
    }
  } else {
    // This is raw document content, use the default insights prompt
    console.log('Using default insights prompt');
    const INSIGHTS_PROMPT = `You are an expert business document analyst with deep expertise in accounting, legal, and business documents. Analyze this document thoughtfully and provide insights that would be genuinely useful to someone working with it.

Please provide a conversational, intelligent analysis covering:

**📋 Document Overview**
- What type of document is this and why was it likely created?
- Who would typically use this and for what purpose?

**💰 Financial & Business Insights**
- Key financial figures, metrics, or business indicators
- Any interesting trends, patterns, or anomalies you notice
- Risk factors or opportunities highlighted

**📅 Important Dates & Deadlines**
- Critical dates, periods, or time-sensitive information
- Filing deadlines, compliance dates, or milestone dates

**✅ Action Items & Next Steps**
- What actions does this document require or suggest?
- Any compliance requirements, follow-ups, or decisions needed

**🔍 Notable Observations**
- Anything unusual, interesting, or particularly important
- Context that might not be immediately obvious
- Professional insights based on document patterns

Please be conversational and insightful - imagine you're briefing a colleague who needs to understand this document quickly but thoroughly. Feel free to ask clarifying questions at the end if there are aspects that would benefit from follow-up discussion.

Document to analyze:`;

    messageContent = `${INSIGHTS_PROMPT}\n\nDocument: ${fileName}\n\nContent:\n${documentText}`;
  }

  console.log('Final message content length:', messageContent.length);
  console.log('Final message preview:', messageContent.substring(0, 300));

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 1200,
      messages: [
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3
    });
  });

  const content = response.content[0];
  if (content.type === 'text') {
    console.log('Claude response length:', content.text.length);
    console.log('Claude response preview:', content.text.substring(0, 200));
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

export async function analyzeTemplateForPlaceholders(templateText: string, templateName: string, model: 'sonnet' | 'haiku' = 'sonnet'): Promise<Array<{original: string, suggested: string, accepted: boolean}>> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const PLACEHOLDER_ANALYSIS_PROMPT = `You are an expert template analyzer. Analyze the following document text and identify potential placeholders that should be made dynamic/variable.

Look for:
1. **Personal Information**: Names, addresses, emails, phone numbers
2. **Financial Data**: Amounts, percentages, account numbers, tax years
3. **Dates**: Any date formats (MM/DD/YYYY, DD-MM-YYYY, Month DD, YYYY, etc.)
4. **Business Data**: Company names, reference numbers, invoice numbers
5. **Legal/Tax Information**: IRD numbers, GST numbers, case numbers
6. **Context-Specific Values**: Any values that would likely change between uses

For each potential placeholder found, suggest a meaningful variable name (use snake_case format).

Return your analysis as a JSON array with this exact format:
[
  {
    "original": "exact text found in document",
    "suggested": "meaningful_variable_name",
    "accepted": true
  }
]

Only return the JSON array, no other text or explanation.

Template Name: ${templateName}
Document Text to Analyze:`;

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 1500,
      messages: [
        { role: 'user', content: `${PLACEHOLDER_ANALYSIS_PROMPT}\n\n${templateText}` }
      ],
      temperature: 0.3
    });
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude');
  }
  
  try {
    // Parse the JSON response
    const placeholders = JSON.parse(content.text.trim());
    
    // Validate the response format
    if (!Array.isArray(placeholders)) {
      throw new Error('Claude response is not an array');
    }
    
    return placeholders.filter((p: any) => 
      p.original && p.suggested && typeof p.accepted === 'boolean'
    );
  } catch (parseError) {
    console.error('Failed to parse Claude placeholder analysis:', content.text);
    throw new Error('Claude returned invalid format for placeholder analysis');
  }
}

export async function generateEmailFromTemplate(
  template: any,
  extractedData: { [key: string]: string },
  model: 'sonnet' | 'haiku' = 'sonnet'
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Prepare prompt for Claude
  const prompt = `You are an expert accountant. Given the following extracted text from PDFs, fill in the placeholders in the provided email template. Only use information found in the PDFs.\n\nExtracted Data:\n${Object.entries(extractedData).map(([cat, text]) => `--- ${cat} ---\n${text || ''}`).join('\n')}\n\nTemplate:\n${template.template}`;

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 800,
      messages: [
        { role: 'user', content: `${prompt}\n\nFill in the template with the extracted data.` }
      ],
      temperature: 0.7
    });
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

// Streaming version of generateEmailFromTemplate
export async function generateEmailFromTemplateStream(
  template: any,
  extractedData: { [key: string]: string },
  model: 'sonnet' | 'haiku' = 'sonnet',
  onChunk: (text: string) => void
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Prepare prompt for Claude
  const prompt = `You are an expert accountant. Given the following extracted text from PDFs, fill in the placeholders in the provided email template. Only use information found in the PDFs.\n\nExtracted Data:\n${Object.entries(extractedData).map(([cat, text]) => `--- ${cat} ---\n${text || ''}`).join('\n')}\n\nTemplate:\n${template.template}`;

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  let fullText = '';
  let lastError: any;
  const maxRetries = 3;
  const initialDelay = 1000;
  
  // Retry logic for streaming
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = client.messages.stream({
        model: modelName,
        max_tokens: 800,
        messages: [
          { role: 'user', content: `${prompt}\n\nFill in the template with the extracted data.` }
        ],
        temperature: 0.7
      });

      // Listen for text deltas
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullText += text;
          onChunk(text);
        }
      }

      return fullText.trim();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit or overload error
      const isRateLimitError = 
        error?.status === 429 || 
        error?.status === 529 ||
        error?.error?.type === 'overloaded_error' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('Overloaded') ||
        error?.message?.includes('rate limit');
      
      if (isRateLimitError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Anthropic API overloaded/rate limited during streaming. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear accumulated text before retry
        fullText = '';
        continue;
      }
      
      // For other errors or if we've exhausted retries, throw
      if (attempt === maxRetries) {
        break;
      }
      throw error;
    }
  }
  
  // If we get here, we've exhausted retries
  if (lastError?.status === 529 || lastError?.error?.type === 'overloaded_error') {
    throw new Error('Anthropic servers are currently overloaded. Please try again in a few moments.');
  }
  
  throw lastError;
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// New function for PDF document analysis using Claude's native PDF support
export async function analyzePdfDocument(
  pdfFilePath: string,
  fileName: string,
  prompt: string,
  model: 'sonnet' | 'haiku' = 'sonnet'
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== CLAUDE PDF DOCUMENT ANALYSIS ===');
  console.log('Model:', model);
  console.log('PDF file path:', pdfFilePath);
  console.log('File name:', fileName);
  console.log('Prompt:', prompt);

  // Read PDF file as buffer and convert to base64
  const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(pdfFilePath);
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);

  console.log('PDF size:', pdfBuffer.byteLength, 'bytes');
  console.log('Base64 length:', pdfBase64.length);

  // Use latest model names
  const modelName = model === 'haiku' 
    ? 'claude-haiku-4-5' 
    : 'claude-sonnet-4-5';

  // Robust JSON parsing that handles common AI output issues
  const normalizeJsonArrayText = (text: string): string => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/g, '');
    cleaned = cleaned.replace(/\s*```$/g, '');
    cleaned = cleaned.replace(/```/g, '').trim();
    return cleaned;
  };

  const parseJsonArray = (text: string): Array<{ [key: string]: string }> => {
    let cleaned = normalizeJsonArrayText(text);
    
    // Try standard parse first
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Continue with fixes
    }
    
    // Fix 1: Try to extract just the array portion
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    }
    
    // Fix 2: Handle trailing commas
    cleaned = cleaned.replace(/,\s*]/g, ']');
    cleaned = cleaned.replace(/,\s*}/g, '}');
    
    // Try parse again
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Continue
    }
    
    // Last attempt
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    return parsed;
  };

  // Build message content with PDF document block
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      }
    },
    {
      type: 'text',
      text: prompt
    }
  ];

  console.log('Sending PDF document to Claude...');

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3
    });
  }, 3, 2000); // Use longer delays for PDF analysis

  const content = response.content[0];
  if (content.type === 'text') {
    console.log('Claude PDF response length:', content.text.length);
    console.log('Claude PDF response preview:', content.text.substring(0, 200));
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

// Streaming version of analyzePdfDocument
export async function analyzePdfDocumentStream(
  pdfFilePath: string,
  fileName: string,
  prompt: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  onChunk: (text: string) => void
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== CLAUDE PDF DOCUMENT ANALYSIS (STREAMING) ===');
  console.log('Model:', model);
  console.log('PDF file path:', pdfFilePath);
  console.log('File name:', fileName);
  console.log('Prompt:', prompt);

  // Read PDF file as buffer and convert to base64
  const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(pdfFilePath);
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);

  console.log('PDF size:', pdfBuffer.byteLength, 'bytes');
  console.log('Base64 length:', pdfBase64.length);

  const modelName = model === 'haiku' 
    ? 'claude-haiku-4-5' 
    : 'claude-sonnet-4-5';

  // Build message content with PDF document block
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      }
    },
    {
      type: 'text',
      text: prompt
    }
  ];

  console.log('Starting PDF document streaming...');

  let fullText = '';
  let lastError: any;
  const maxRetries = 3;
  const initialDelay = 2000;
  
  // Retry logic for streaming
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = client.messages.stream({
        model: modelName,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: messageContent }
        ],
        temperature: 0.3
      });

      // Listen for text deltas
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullText += text;
          onChunk(text);
        }
      }

      console.log('Claude PDF streaming response complete. Length:', fullText.length);
      return fullText.trim();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit or overload error
      const isRateLimitError = 
        error?.status === 429 || 
        error?.status === 529 ||
        error?.error?.type === 'overloaded_error' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('Overloaded') ||
        error?.message?.includes('rate limit');
      
      if (isRateLimitError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Anthropic API overloaded/rate limited during PDF streaming. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear accumulated text before retry
        fullText = '';
        continue;
      }
      
      // For other errors or if we've exhausted retries, throw
      if (attempt === maxRetries) {
        break;
      }
      throw error;
    }
  }
  
  // If we get here, we've exhausted retries
  if (lastError?.status === 529 || lastError?.error?.type === 'overloaded_error') {
    throw new Error('Anthropic servers are currently overloaded. Please try again in a few moments.');
  }
  
  throw lastError;
}

// Streaming version for multiple PDF documents
export async function analyzeMultiplePdfDocumentsStream(
  pdfFiles: Array<{ path: string; name: string; base64?: string }>,
  prompt: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  onChunk: (text: string) => void
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== CLAUDE MULTIPLE PDF DOCUMENT ANALYSIS (STREAMING) ===');
  console.log('Model:', model);
  console.log('Number of PDFs:', pdfFiles.length);
  console.log('Files:', pdfFiles.map(f => f.name).join(', '));
  console.log('Prompt:', prompt);

  const modelName = model === 'haiku'
    ? 'claude-haiku-4-5'
    : 'claude-sonnet-4-5';

  // Build message content with multiple PDF document blocks
  const messageContent: any[] = [];
  
  // Add all PDF documents
  for (const file of pdfFiles) {
    let pdfBase64: string;
    
    // Use provided base64 if available, otherwise read the file
    if (file.base64) {
      pdfBase64 = file.base64;
    } else {
      const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(file.path);
      pdfBase64 = arrayBufferToBase64(pdfBuffer);
    }
    
    console.log(`Adding document: ${file.name} (${pdfBase64.length} base64 chars)`);
    
    messageContent.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      },
      cache_control: { type: 'ephemeral' } // Cache PDFs for follow-up questions
    });
  }
  
  // Add the prompt text after all documents
  messageContent.push({
    type: 'text',
    text: prompt
  });

  console.log('Starting multiple PDF document streaming...');

  let fullText = '';
  let lastError: any;
  const maxRetries = 3;
  const initialDelay = 2000;

  // Retry logic for streaming
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = client.messages.stream({
        model: modelName,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: messageContent }
        ],
        temperature: 0.3
      });

      // Listen for text deltas
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullText += text;
          onChunk(text);
        }
      }

      console.log('Claude multiple PDF streaming response complete. Length:', fullText.length);
      return fullText.trim();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit or overload error
      const isRateLimitError =
        error?.status === 429 ||
        error?.status === 529 ||
        error?.error?.type === 'overloaded_error' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('Overloaded') ||
        error?.message?.includes('rate limit');

      if (isRateLimitError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Anthropic API overloaded/rate limited during multiple PDF streaming. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Clear accumulated text before retry
        fullText = '';
        continue;
      }

      // For other errors or if we've exhausted retries, throw
      throw error;
    }
  }

  // If we get here, we've exhausted retries
  if (lastError?.status === 529 || lastError?.error?.type === 'overloaded_error') {
    throw new Error('Anthropic servers are currently overloaded. Please try again in a few moments.');
  }

  throw lastError;
}

// Detect PDF table headers - scans first page, then all pages if needed
export async function detectPdfHeaders(
  pdfFilePath: string,
  fileName: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  scanFirstPageOnly: boolean = true,
  onProgress?: (status: string) => void
): Promise<string[]> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== DETECT PDF HEADERS ===');
  console.log('Model:', model);
  console.log('PDF file path:', pdfFilePath);
  console.log('File name:', fileName);
  console.log('Scan first page only:', scanFirstPageOnly);

  // Use haiku for header detection - it's cheaper and faster for this simple task
  const modelName = 'claude-haiku-4-5';

  const basePrompt = `Extract all table column headers from the following PDF page text. If a header cell contains ' - ' delimiter, split it into separate headers. Return ONLY a JSON array of header names, nothing else. For example, if a cell shows 'Date - Transaction Date', return ["Date", "Transaction Date"] as separate headers. If no headers are found, return an empty array [].`;

  onProgress?.('Analyzing PDF structure...');
  const pageCountResult = await (window.electronAPI as any).getPdfPageCount(pdfFilePath);
  const pageCount = pageCountResult?.success ? pageCountResult.pageCount : 0;
  console.log('PDF page count:', pageCount);

  // ALWAYS try text-first approach - it uses far fewer tokens than base64
  // Only scan first 3 pages for headers (headers are rarely beyond page 3)
  onProgress?.('Extracting text from PDF pages...');
  const pagesText: string[] = await (window.electronAPI as any).readPdfPagesText(pdfFilePath);
  const maxPagesToScan = scanFirstPageOnly ? 1 : Math.min(3, pagesText.length);
  const hasAnyText = pagesText.slice(0, maxPagesToScan).some(text => (text || '').trim().length >= 10);

  if (hasAnyText) {
    console.log(`Header detection using text-first approach (scanning up to ${maxPagesToScan} pages)`);
    onProgress?.(`Scanning ${maxPagesToScan} page(s) for headers...`);
    
    for (let i = 0; i < maxPagesToScan; i++) {
      const pageText = pagesText[i] || '';
      if (!pageText.trim() || pageText.trim().length < 10) {
        console.log(`Page ${i + 1} has no readable text, skipping`);
        onProgress?.(`Page ${i + 1} has no readable text, skipping...`);
        continue;
      }
      
      console.log(`Scanning page ${i + 1} for headers (${pageText.length} chars)`);
      onProgress?.(`Scanning page ${i + 1} of ${maxPagesToScan} for headers...`);
      const prompt = `${basePrompt}\n\nPAGE ${i + 1} TEXT:\n${pageText}`;
      
      const response = await retryWithBackoff(async () => {
        return await client.messages.create({
          model: modelName,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        });
      }, 3, 3000);

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const headers = JSON.parse(jsonText);
      if (Array.isArray(headers) && headers.filter(h => typeof h === 'string' && h.trim()).length > 0) {
        const cleanedHeaders = headers.map((h: string) => h.trim()).filter((h: string) => h.length > 0);
        console.log('Detected headers:', cleanedHeaders);
        onProgress?.(`Found ${cleanedHeaders.length} header(s) on page ${i + 1}`);
        return cleanedHeaders;
      }
      
      console.log(`No headers found on page ${i + 1}, trying next page...`);
      if (i < maxPagesToScan - 1) {
        onProgress?.(`No headers found on page ${i + 1}, checking next page...`);
      }
    }
    
    // No headers found in text - return empty
    console.log('No headers found in scanned pages');
    onProgress?.('No headers found in scanned pages');
    return [];
  }

  // FALLBACK: PDF is likely scanned/image-based - use base64 but ONLY first few pages
  console.log('No readable text found - PDF appears to be scanned. Using base64 approach.');
  onProgress?.('PDF appears to be scanned. Using image-based detection...');
  
  // Read PDF file as buffer and convert to base64
  onProgress?.('Reading PDF file...');
  const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(pdfFilePath);
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);

  const headerDetectionPrompt = `Extract all table column headers from the FIRST PAGE of this PDF document. If a header cell contains ' - ' delimiter, split it into separate headers. Return ONLY a JSON array of header names, nothing else. For example, if a cell shows 'Date - Transaction Date', return ["Date", "Transaction Date"] as separate headers. If no headers are found, return an empty array [].`;

  // Build message content with PDF document block
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      }
    },
    {
      type: 'text',
      text: headerDetectionPrompt
    }
  ];

  onProgress?.('Sending to AI for header detection...');
  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3
    });
  }, 3, 2000);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude');
  }

  try {
    // Parse JSON array from response
    const responseText = content.text.trim();
    // Remove markdown code blocks if present
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const headers = JSON.parse(jsonText);
    
    if (!Array.isArray(headers)) {
      throw new Error('Response is not an array');
    }

    // Filter out empty strings and normalize
    const cleanedHeaders = headers
      .filter((h: any) => h && typeof h === 'string' && h.trim().length > 0)
      .map((h: string) => h.trim());

    console.log('Detected headers:', cleanedHeaders);
    if (cleanedHeaders.length > 0) {
      onProgress?.(`Found ${cleanedHeaders.length} header(s)`);
    } else {
      onProgress?.('No headers detected');
    }
    return cleanedHeaders;
  } catch (parseError) {
    console.error('Failed to parse headers response:', content.text);
    throw new Error('Failed to parse header detection response. AI did not return valid JSON array.');
  }
}

// Extract PDF table data based on column mappings
export async function extractPdfTableData(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] },
  model: 'sonnet' | 'haiku' = 'sonnet'
): Promise<Array<{ [key: string]: string }>> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== EXTRACT PDF TABLE DATA ===');
  console.log('Model:', model);
  console.log('PDF file path:', pdfFilePath);
  console.log('File name:', fileName);
  console.log('Column mappings:', columnMappings);

  // Read PDF file as buffer and convert to base64
  const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(pdfFilePath);
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);

  const modelName = model === 'haiku' 
    ? 'claude-haiku-4-5' 
    : 'claude-sonnet-4-5';

  // Build mapping description for prompt
  const mappingDescription = Object.entries(columnMappings)
    .map(([fixedCol, docHeaders]) => {
      if (docHeaders.length === 0) return null;
      if (docHeaders.length === 1) {
        return `"${fixedCol}" column should use data from document header "${docHeaders[0]}"`;
      }
      return `"${fixedCol}" column should merge data from document headers: ${docHeaders.map(h => `"${h}"`).join(', ')}. Combine their values with spaces.`;
    })
    .filter(Boolean)
    .join('\n');

  const extractionPrompt = `Extract all table rows from this PDF document. Map the data according to these column mappings. IMPORTANT: Only process pages that contain the transaction table; ignore non-table pages. If the table spans multiple pages, continue until no more rows appear, then stop.

${mappingDescription}

IMPORTANT:
- Return ONLY a JSON array of objects, nothing else
- Each object should have keys matching the fixed column names: ${Object.keys(columnMappings).map(k => `"${k}"`).join(', ')}
- When multiple document headers map to one CSV column, merge their values with spaces (e.g., if Description='Invoice', Trans='T123', Reference='REF456' all map to 'Description', combine as "Invoice T123 REF456")
- If a value is missing or empty, use empty string ""
- Extract ALL rows from the document
- Return as JSON array: [{...}, {...}, ...]`;

  // Build message content with PDF document block
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      }
    },
    {
      type: 'text',
      text: extractionPrompt
    }
  ];

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 8000,
      messages: [
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3
    });
  }, 3, 2000);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude');
  }

  try {
    // Parse JSON array from response
    let responseText = content.text.trim();
    
    // Remove markdown code blocks if present - handle various formats
    // Remove ```json at start
    responseText = responseText.replace(/^```json\s*/i, '');
    // Remove ``` at start or end
    responseText = responseText.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    // Remove any remaining ``` markers
    responseText = responseText.replace(/```/g, '').trim();
    
    const rows = JSON.parse(responseText);
    
    if (!Array.isArray(rows)) {
      throw new Error('Response is not an array');
    }

    console.log('Extracted rows:', rows.length);
    return rows;
  } catch (parseError) {
    console.error('Failed to parse extraction response:', content.text);
    console.error('Parse error:', parseError);
    throw new Error('Failed to parse data extraction response. AI did not return valid JSON array.');
  }
}

// Page-by-page extraction with progress callback
export async function extractPdfTableDataStream(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] },
  model: 'sonnet' | 'haiku' = 'sonnet',
  onChunk: (rows: Array<{ [key: string]: string }>) => void,
  onProgress?: (progress: { currentPage: number; totalPages: number; status: string }) => void
): Promise<Array<{ [key: string]: string }>> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== EXTRACT PDF TABLE DATA (STREAMING) ===');
  console.log('Model:', model);
  console.log('PDF file path:', pdfFilePath);
  console.log('File name:', fileName);
  console.log('Column mappings:', columnMappings);

  const modelName = model === 'haiku' 
    ? 'claude-haiku-4-5' 
    : 'claude-sonnet-4-5';

  // Robust JSON parsing that handles common AI output issues
  const normalizeJsonArrayText = (text: string): string => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/g, '');
    cleaned = cleaned.replace(/\s*```$/g, '');
    cleaned = cleaned.replace(/```/g, '').trim();
    return cleaned;
  };

  const parseJsonArray = (text: string): Array<{ [key: string]: string }> => {
    let cleaned = normalizeJsonArrayText(text);
    
    // Try standard parse first
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Continue with fixes
    }
    
    // Fix 1: Try to extract just the array portion if there's extra text
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    }
    
    // Fix 2: Handle trailing commas (common AI mistake)
    cleaned = cleaned.replace(/,\s*]/g, ']');
    cleaned = cleaned.replace(/,\s*}/g, '}');
    
    // Fix 3: Try parse again after fixes
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Try replacing single quotes with double quotes
      const singleQuoteFixed = cleaned
        .replace(/'([^']*)':/g, '"$1":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      try {
        const parsed = JSON.parse(singleQuoteFixed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e2) {
        // Continue
      }
    }
    
    // Fix 4: Try to parse line by line and extract valid objects
    try {
      const lines = cleaned.split('\n');
      const objects: any[] = [];
      let currentObj = '';
      let braceCount = 0;
      
      for (const line of lines) {
        currentObj += line;
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        
        if (braceCount === 0 && currentObj.includes('{')) {
          const objMatch = currentObj.match(/\{[^{}]*\}/);
          if (objMatch) {
            try {
              let objStr = objMatch[0];
              objStr = objStr.replace(/,\s*}/g, '}');
              const obj = JSON.parse(objStr);
              if (typeof obj === 'object' && obj !== null) {
                objects.push(obj);
              }
            } catch (e) {
              // Skip malformed object, mark as error row
              console.warn('[JSON Parse] Skipping malformed object');
            }
          }
          currentObj = '';
        }
      }
      
      if (objects.length > 0) {
        console.log(`[JSON Parse] Recovered ${objects.length} objects from malformed JSON`);
        return objects;
      }
    } catch (e) {
      // Final fallback failed
    }
    
    // Last attempt with original cleaned text
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    return parsed;
  };

  // Build mapping description for prompt
  const mappingDescription = Object.entries(columnMappings)
    .map(([fixedCol, docHeaders]) => {
      if (docHeaders.length === 0) return null;
      if (docHeaders.length === 1) {
        return `"${fixedCol}" column should use data from document header "${docHeaders[0]}"`;
      }
      return `"${fixedCol}" column should merge data from document headers: ${docHeaders.map(h => `"${h}"`).join(', ')}. Combine their values with spaces.`;
    })
    .filter(Boolean)
    .join('\n');

  const extractionPrompt = `Extract all table rows from this PDF document. Map the data according to these column mappings:

${mappingDescription}

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY a valid JSON array, nothing else. Do NOT wrap in markdown code blocks (no \`\`\`json or \`\`\`).
- Start with [ and end with ]
- Each object should have keys matching the fixed column names: ${Object.keys(columnMappings).map(k => `"${k}"`).join(', ')}
- When multiple document headers map to one CSV column, merge their values with spaces (e.g., if Description='Invoice', Trans='T123', Reference='REF456' all map to 'Description', combine as "Invoice T123 REF456")
- If a value is missing or empty, use empty string ""
- Extract ALL rows from the document
- Return as JSON array: [{...}, {...}, ...]`;

  // For ANY PDF, try text extraction first - it uses far fewer tokens
  const pageCountResult = await (window.electronAPI as any).getPdfPageCount(pdfFilePath);
  const pageCount = pageCountResult?.success ? pageCountResult.pageCount : 0;
  console.log(`PDF has ${pageCount} pages`);
  
  // Report initial progress
  onProgress?.({ currentPage: 0, totalPages: pageCount, status: 'Analyzing PDF...' });
  
  const pagesText: string[] = await (window.electronAPI as any).readPdfPagesText(pdfFilePath);
  const hasTextPages = pagesText.some(text => (text || '').trim().length >= 10);
  
  if (hasTextPages) {
    console.log(`Using text-based extraction for ${pageCount} pages (much lighter on tokens)`);
    
    // Process ONE page at a time with longer delays to avoid rate limits
    const allRows: Array<{ [key: string]: string }> = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Count pages with actual content
    const pagesWithContent = pagesText.filter(t => (t || '').trim().length >= 10).length;
    let processedPages = 0;

    for (let i = 0; i < pagesText.length; i++) {
      const pageText = pagesText[i] || '';
      if (!pageText.trim() || pageText.trim().length < 10) {
        console.log(`[PDF page ${i + 1}] skipped (empty/no text)`);
        continue;
      }
      
      processedPages++;
      // Report progress before processing
      onProgress?.({ 
        currentPage: processedPages, 
        totalPages: pagesWithContent, 
        status: `Processing page ${i + 1} of ${pageCount}...` 
      });
      
      // Compact prompt to reduce token usage
      const pagePrompt = `Extract table rows from page ${i + 1}. Column mappings:\n${mappingDescription}\n\nReturn ONLY JSON array [{...}]. Keys: ${Object.keys(columnMappings).map(k => `"${k}"`).join(', ')}. Empty values = "". No markdown.\n\nTEXT:\n${pageText}`;

      console.log(`[PDF page ${i + 1}] textChars=${pageText.length}`);
      
      try {
        const response = await retryWithBackoff(async () => {
          return await client.messages.create({
            model: modelName,
            max_tokens: 1500,
            messages: [{ role: 'user', content: pagePrompt }],
            temperature: 0.1
          });
        }, 3, 3000);

        const content = response.content[0];
        if (content.type === 'text') {
          const pageRows = parseJsonArray(content.text);
          if (pageRows.length > 0) {
            console.log(`[PDF page ${i + 1}] extracted ${pageRows.length} rows`);
            onChunk(pageRows);
            allRows.push(...pageRows);
          }
        }
      } catch (pageError: any) {
        console.warn(`[PDF page ${i + 1}] extraction failed:`, pageError.message);
        // Continue to next page instead of failing entirely
      }

      // Wait 1.5 seconds between pages to stay under rate limits (30k tokens/min)
      if (i < pagesText.length - 1) {
        await delay(1500);
      }
    }

    if (allRows.length > 0) {
      onProgress?.({ currentPage: pagesWithContent, totalPages: pagesWithContent, status: 'Complete' });
      return allRows;
    }
    
    console.log('Text extraction yielded no rows, falling back to base64...');
  } else {
    console.log('No readable text in PDF, using base64 approach for scanned document...');
  }

  // For scanned PDFs, warn that this is token-heavy and may hit rate limits
  onProgress?.({ 
    currentPage: 0, 
    totalPages: 1, 
    status: 'Scanned PDF detected - this may take longer and use more API credits...' 
  });

  // Wait a few seconds before processing scanned PDFs to allow rate limit to recover
  console.log('Waiting 5 seconds before processing scanned PDF to avoid rate limits...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Calculate max_tokens based on page count - more pages = more rows = more tokens needed
  // Rough estimate: ~500 tokens per page for output, with minimum of 8000
  // No upper limit - let Claude's API enforce its own maximums
  const estimatedMaxTokens = Math.max(pageCount * 500, 8000);
  console.log(`[Scanned PDF] ${pageCount} pages, using max_tokens: ${estimatedMaxTokens}`);
  
  onProgress?.({ 
    currentPage: 0, 
    totalPages: 1, 
    status: `Processing scanned PDF (${pageCount} pages, this is token-intensive)...` 
  });

  // Read PDF file as buffer and convert to base64
  const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(pdfFilePath);
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);

  // Enhanced prompt that emphasizes extracting ALL rows
  const enhancedExtractionPrompt = `${extractionPrompt}

CRITICAL: This PDF has ${pageCount} pages. You MUST extract ALL table rows from ALL pages. Do not stop early. If you reach the token limit, continue extracting rows until you have processed every page. Return the complete array with all rows.`;

  // Build message content with PDF document block
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdfBase64
      }
    },
    {
      type: 'text',
      text: enhancedExtractionPrompt
    }
  ];

  let accumulatedText = '';
  let parsedRows: Array<{ [key: string]: string }> = [];
  let lastError: any;
  const maxRetries = 3;
  const initialDelay = 10000; // 10 second initial delay for scanned PDFs (they're token-heavy)
  
  // Retry logic for streaming
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let stream;
      try {
        stream = client.messages.stream({
          model: modelName,
          max_tokens: estimatedMaxTokens,
          messages: [
            { role: 'user', content: messageContent }
          ],
          temperature: 0.3
        });
      } catch (streamError: any) {
        // Check if it's a rate limit error during stream creation
        const isRateLimitError = 
          streamError?.status === 429 || 
          streamError?.statusCode === 429 ||
          streamError?.error?.type === 'rate_limit_error' ||
          streamError?.message?.includes('rate limit') ||
          streamError?.message?.includes('rate_limit_error') ||
          streamError?.message?.includes('exceed the rate limit');
        
        if (isRateLimitError && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(`Rate limit hit during stream creation. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw streamError;
      }

      // Process streaming chunks
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            accumulatedText += chunk.delta.text;
            
            // Try to parse complete JSON objects as they arrive
            // Look for complete JSON objects within the array
            try {
              // Remove markdown code blocks if present
            let jsonText = normalizeJsonArrayText(accumulatedText);
              
              // Try to find complete objects by looking for closing braces followed by commas or closing bracket
              // This is a heuristic approach - we'll try to parse complete objects
              const objectMatches = jsonText.match(/\{[^}]*\}/g);
              if (objectMatches && objectMatches.length > parsedRows.length) {
                // Try to parse the last few complete objects
                const lastFewObjects = objectMatches.slice(parsedRows.length);
                const newRows: Array<{ [key: string]: string }> = [];
                
                for (const objStr of lastFewObjects) {
                  try {
                    const parsed = JSON.parse(objStr);
                    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                      newRows.push(parsed);
                    }
                  } catch (e) {
                    // Object not complete yet, skip
                  }
                }
                
                if (newRows.length > 0) {
                  parsedRows = [...parsedRows, ...newRows];
                  onChunk(newRows);
                }
              }
            } catch (e) {
              // Not complete yet, continue accumulating
            }
          }
        }
      } catch (streamError: any) {
        // Check if error occurred during streaming
        const isRateLimitError = 
          streamError?.status === 429 || 
          streamError?.statusCode === 429 ||
          streamError?.error?.type === 'rate_limit_error' ||
          streamError?.message?.includes('rate limit') ||
          streamError?.message?.includes('rate_limit_error') ||
          streamError?.message?.includes('exceed the rate limit');
        
        if (isRateLimitError && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          const delaySeconds = Math.round(delay / 1000);
          console.log(`Rate limit hit during streaming. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          onProgress?.({ 
            currentPage: 0, 
            totalPages: 1, 
            status: `Rate limited. Waiting ${delaySeconds}s before retry ${attempt + 1}/${maxRetries}...` 
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Clear accumulated text before retry
          accumulatedText = '';
          parsedRows = [];
          continue;
        }
        throw streamError;
      }

      // Check if response appears truncated (doesn't end with closing bracket)
      const trimmedText = accumulatedText.trim();
      const isTruncated = !trimmedText.endsWith(']') && trimmedText.includes('[');
      
      if (isTruncated) {
        console.warn(`[WARNING] Response appears truncated. PDF has ${pageCount} pages but response may be incomplete.`);
        onProgress?.({ 
          currentPage: 1, 
          totalPages: 1, 
          status: `WARNING: Response may be truncated. Extracted partial data from ${pageCount}-page PDF.` 
        });
      }

      // Final parse of complete response
      const finalRows = parseJsonArray(accumulatedText);

      // Send any remaining rows that weren't streamed
      if (finalRows.length > parsedRows.length) {
        onChunk(finalRows.slice(parsedRows.length));
      }

      console.log(`Extracted rows: ${finalRows.length} from ${pageCount}-page PDF`);
      
      // Warn if we got suspiciously few rows for a large PDF
      if (pageCount > 10 && finalRows.length < pageCount * 2) {
        console.warn(`[WARNING] Only extracted ${finalRows.length} rows from ${pageCount}-page PDF. This may be incomplete.`);
      }
      
      onProgress?.({ currentPage: 1, totalPages: 1, status: 'Complete' });
      return finalRows;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      const isRateLimitError = 
        error?.status === 429 || 
        error?.statusCode === 429 ||
        error?.error?.type === 'rate_limit_error' ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('rate_limit_error') ||
        error?.message?.includes('exceed the rate limit');
      
      if (isRateLimitError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        const delaySeconds = Math.round(delay / 1000);
        console.log(`Rate limit hit during streaming. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        onProgress?.({ 
          currentPage: 0, 
          totalPages: 1, 
          status: `Rate limited. Waiting ${delaySeconds}s before retry ${attempt + 1}/${maxRetries}...` 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear accumulated text before retry
        accumulatedText = '';
        parsedRows = [];
        continue;
      }
      
      // For other errors or if we've exhausted retries, try to parse what we have
      if (accumulatedText.trim().length > 0) {
        try {
          const parsed = parseJsonArray(accumulatedText);
          if (parsed.length > 0) {
            console.log('Recovered partial data:', parsed.length, 'rows');
            return parsed;
          }
        } catch (parseError) {
          // Ignore parse error
        }
      }
      
      // If we've exhausted retries or it's not a rate limit error, throw
      if (attempt === maxRetries || !isRateLimitError) {
        break;
      }
    }
  }
  
  // If we get here, we've exhausted retries
  if (lastError?.status === 429 || lastError?.error?.type === 'rate_limit_error' || lastError?.message?.includes('rate limit')) {
    throw new Error('Rate limit exceeded. This PDF appears to be scanned (image-based), which requires sending the entire document and uses significantly more API credits. Please wait 1-2 minutes and try again, or consider using a smaller PDF.');
  }
  
  throw lastError || new Error('Failed to extract data');
}

// Analyze window activity data and provide insights
export async function analyzeWindowActivity(
  windowActivityData: string,
  model: 'sonnet' | 'haiku' = 'haiku',
  apiKey?: string // Optional API key - if not provided, will try to get from settings
): Promise<string> {
  // If API key not provided, try to get from settings (works in renderer process)
  let finalApiKey = apiKey;
  if (!finalApiKey) {
    try {
      const settings = await settingsService.getSettings();
      finalApiKey = settings.claudeApiKey;
    } catch (error) {
      // If settingsService fails (e.g., in main process), apiKey must be provided
      if (!finalApiKey) {
        throw new Error('Claude API key not set. Please provide API key or ensure settings are accessible.');
      }
    }
  }
  
  if (!finalApiKey) {
    throw new Error('Claude API key not set.');
  }

  const client = new Anthropic({
    apiKey: finalApiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data and summarize the apps used.

IMPORTANT: Your response must be formatted as a markdown table with exactly 2 columns:
1. App Name
2. Time (in HH:MM format)

Format the output as a markdown table with headers: "App Name | Time"

For each app used, analyze the window activity logs to:
- Identify the application or service being used
- Calculate the total time spent in that app
- Group multiple instances of the same app together

CRITICAL RULES FOR APP NAMING:
- For web browsers (MS Edge, Chrome, Firefox, Safari, etc.), extract the website/service name from the window title instead of using the browser name
  - Example: "MS Edge - Xero" should be recorded as "Xero" (not "MS Edge")
  - Example: "Chrome - Gmail" should be recorded as "Gmail" (not "Chrome")
  - Example: "Firefox - GitHub" should be recorded as "GitHub" (not "Firefox")
- For desktop applications, use the application name (e.g., "Visual Studio Code", "Excel", "Word")
- If a browser window title doesn't contain a clear website/service name, use the browser name as fallback
- Group similar apps together (e.g., all "Xero" entries regardless of browser should be one row)

Rules:
- Sum up all time spent in each app across the entire activity log
- Time should be in HH:MM format (e.g., "02:30" for 2 hours 30 minutes)
- Sort apps by time spent (descending order)
- Each app should appear only once in the table`;

  const response = await retryWithBackoff(async () => {
    return await client.messages.create({
      model: modelName,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: [{ 
            type: 'text', 
            text: `Please analyze the following window activity data:\n\n${windowActivityData}` 
          }] 
        }
      ],
      temperature: 0.7
    });
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

// Streaming version of analyzeWindowActivity
// New function to analyze a single task and return structured sub-tasks
export async function analyzeTaskSubTasks(
  windowActivityData: string,
  model: 'sonnet' | 'haiku' = 'haiku',
  apiKey?: string
): Promise<Array<{ name: string; timeSpent: number }>> {
  let finalApiKey = apiKey;
  if (!finalApiKey) {
    try {
      const settings = await settingsService.getSettings();
      finalApiKey = settings.claudeApiKey;
    } catch (error) {
      if (!finalApiKey) {
        throw new Error('Claude API key not set.');
      }
    }
  }
  
  if (!finalApiKey) {
    throw new Error('Claude API key not set.');
  }

  const client = new Anthropic({
    apiKey: finalApiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data for a SINGLE task and categorize ALL activities into EXACTLY these categories:

ALLOWED CATEGORIES (ONLY these should appear):
1. Xero
2. Xero Practice Manager (XPM)
3. Outlook
4. Excel
5. PDF Xchange
6. Go FYI (Document Management / Jobs)
7. Spotify
8. CMD
9. Idle Time

IMPORTANT: Your response must be formatted as a simple list with time allocations:
## Category Name (HH:MM)
## Category Name (HH:MM)

CRITICAL MAPPING RULES - Map ALL window titles to these categories:

1. XERO:
   - Any window title containing "Xero" (but NOT "XPM" or "Practice Manager")
   - Examples: "MS Edge - Xero", "Chrome - Xero - Client Name", "Xero - Dashboard"

2. XERO PRACTICE MANAGER (XPM):
   - Any window title containing "XPM" or "Xero Practice Manager" or "Practice Manager"
   - Examples: "XPM", "Xero Practice Manager", "Practice Manager - Jobs"

3. OUTLOOK:
   - Any window title containing "Outlook" or "Microsoft Outlook"
   - Examples: "Outlook", "Microsoft Outlook - Inbox", "Outlook - Calendar"

4. EXCEL:
   - Any window title containing "Excel" or "Microsoft Excel"
   - Examples: "Excel", "Microsoft Excel - Workbook.xlsx", "Excel - Sheet1"

5. PDF XCHANGE:
   - Any window title containing "PDF Xchange" or "PDF-XChange" or "PDFXChange"
   - Examples: "PDF Xchange Editor", "PDF-XChange Viewer", "PDFXChange"

6. GO FYI (DOCUMENT MANAGEMENT / JOBS):
   - Any window title containing "Go FYI" or "GoFYI" or "Document Management" or "Jobs" (when referring to document management system)
   - Examples: "Go FYI", "Document Management", "Jobs - Go FYI", "GoFYI - Client Documents"

7. SPOTIFY:
   - Any window title containing "Spotify"
   - Examples: "Spotify", "Spotify - Song Name", "Spotify Premium"

8. CMD:
   - Any window title containing "Command Prompt" or "CMD" or "Windows Command Processor" or "PowerShell"
   - Examples: "Command Prompt", "CMD", "Windows PowerShell", "PowerShell"

9. IDLE TIME (catch-all for everything else):
   - Google searches (any window title with "and X more pages" or search-like content)
   - AI usage (ChatGPT, Claude, Copilot, Bard, Perplexity, etc.)
   - Non-accounting related activities (YouTube, social media, games, entertainment, etc.)
   - Any browser activity that doesn't match the above categories
   - Any other application that doesn't match the above categories
   - Examples: "Chrome - Google Search", "ChatGPT", "YouTube", "Facebook", "Twitter", "GitHub", "Visual Studio Code", etc.

CALCULATION RULES:
- Calculate the total time spent in each category by summing all matching window activity entries
- Time should be in HH:MM format (e.g., "02:30" for 2 hours 30 minutes)
- Each category should appear only once in the list (sum all instances together)
- Include time spent in parentheses after each category name (HH:MM format)
- Time allocations should sum to the total task duration
- Sort categories by time spent (descending order), EXCEPT "Idle Time" which must ALWAYS be last

CRITICAL REQUIREMENTS:
- ONLY return categories from the allowed list above
- DO NOT create new categories or use different names
- If a window title matches multiple categories, use the most specific match (e.g., "XPM" takes precedence over "Xero")
- "Idle Time" must ALWAYS be the very last entry in the list, regardless of its duration
- If a category has 0 time, DO NOT include it in the response`;

  let fullText = '';
  await retryWithBackoff(async () => {
    const stream = await client.messages.stream({
      model: modelName,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: [{ 
            type: 'text', 
            text: `Analyze this task's window activity and summarize the apps used:\n\n${windowActivityData}` 
          }] 
        }
      ],
      temperature: 0.3
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }
  });
  
  // Parse the response to extract apps
  const apps: Array<{ name: string; timeSpent: number }> = [];
  const lines = fullText.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('##')) {
      // Extract category name and time
      // Handle category names that may contain parentheses (e.g., "Xero Practice Manager (XPM)")
      // Match everything up to the time pattern at the end: (HH:MM)
      const match = trimmed.match(/^##\s*(.+)\s+\((\d{1,2}):(\d{2})\)$/);
      if (match) {
        const name = match[1].trim();
        const hours = parseInt(match[2]);
        const minutes = parseInt(match[3]);
        const timeSpent = hours * 3600 + minutes * 60;
        apps.push({ name, timeSpent });
      }
    }
  }
  
  // Sort apps by time spent (descending), but always put "Idle Time" at the end
  const idleTimeEntry = apps.find(app => app.name.toLowerCase() === 'idle time');
  const otherApps = apps.filter(app => app.name.toLowerCase() !== 'idle time');
  
  // Sort other apps by time spent (descending)
  otherApps.sort((a, b) => b.timeSpent - a.timeSpent);
  
  // Combine: other apps first, then idle time at the end (if present)
  return idleTimeEntry ? [...otherApps, idleTimeEntry] : otherApps;
}

export async function analyzeWindowActivityStream(
  windowActivityData: string,
  model: 'sonnet' | 'haiku' = 'haiku',
  onChunk: (chunk: string) => void,
  apiKey?: string // Optional API key - if not provided, will try to get from settings
): Promise<void> {
  // If API key not provided, try to get from settings (works in renderer process)
  let finalApiKey = apiKey;
  if (!finalApiKey) {
    try {
      const settings = await settingsService.getSettings();
      finalApiKey = settings.claudeApiKey;
    } catch (error) {
      // If settingsService fails (e.g., in main process), apiKey must be provided
      if (!finalApiKey) {
        throw new Error('Claude API key not set. Please provide API key or ensure settings are accessible.');
      }
    }
  }
  
  if (!finalApiKey) {
    throw new Error('Claude API key not set.');
  }

  const client = new Anthropic({
    apiKey: finalApiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data and summarize the apps used.

IMPORTANT: Your response must be formatted as a markdown table with exactly 2 columns:
1. App Name
2. Time (in HH:MM format)

Format the output as a markdown table with headers: "App Name | Time"

For each app used, analyze the window activity logs to:
- Identify the application or service being used
- Calculate the total time spent in that app
- Group multiple instances of the same app together

CRITICAL RULES FOR APP NAMING:
- For web browsers (MS Edge, Chrome, Firefox, Safari, etc.), extract the website/service name from the window title instead of using the browser name
  - Example: "MS Edge - Xero" should be recorded as "Xero" (not "MS Edge")
  - Example: "Chrome - Gmail" should be recorded as "Gmail" (not "Chrome")
  - Example: "Firefox - GitHub" should be recorded as "GitHub" (not "Firefox")
- For desktop applications, use the application name (e.g., "Visual Studio Code", "Excel", "Word")
- If a browser window title doesn't contain a clear website/service name, use the browser name as fallback
- Group similar apps together (e.g., all "Xero" entries regardless of browser should be one row)

Rules:
- Sum up all time spent in each app across the entire activity log
- Time should be in HH:MM format (e.g., "02:30" for 2 hours 30 minutes)
- Sort apps by time spent (descending order)
- Each app should appear only once in the table`;

  return await retryWithBackoff(async () => {
    const stream = await client.messages.stream({
      model: modelName,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: [{ 
            type: 'text', 
            text: `Please analyze the following window activity data:\n\n${windowActivityData}` 
          }] 
        }
      ],
      temperature: 0.7
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text);
      }
    }
  });
}