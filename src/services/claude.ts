import { settingsService } from './settings';
import Anthropic from '@anthropic-ai/sdk';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
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
        error?.status === 529 ||
        error?.error?.type === 'overloaded_error' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('rate limit');
      
      if (isRateLimitError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Anthropic API overloaded/rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
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

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data and provide a summary in a specific format.

IMPORTANT: Your response must be formatted as a markdown table with exactly 4 columns:
1. Task name
2. Total Duration (in HH:MM format)
3. Productive Time (in HH:MM format) - time spent on productive work activities
4. Achievements (bullet points only, no narrative)

Format the output as a markdown table with headers: "Task Name | Total Duration | Productive Time | Achievements"

For each task, analyze the window activity logs to:
- Calculate productive time by identifying time spent on work-related applications vs distractions
- List specific achievements as bullet points (what was accomplished, not what was done)
- Identify time lost to distractions, context switching, or non-productive activities

After the table, add a single summary sentence in this format:
"Total time spent: [X hours Y minutes], Productive time: [X hours Y minutes], Time lost: [X hours Y minutes]"

Rules:
- Use bullet points (• or -) for achievements, not narrative text
- Be specific about what was achieved (e.g., "• Completed feature X", "• Fixed bug Y")
- Calculate productive time based on application usage patterns
- Keep achievements BRIEF and concise - maximum 8-10 words per bullet point
- Focus on key accomplishments only, avoid verbose descriptions
- Use action verbs and be direct (e.g., "• Processed tax forms" not "• Reviewed and processed 2025 IR3 tax forms for both clients")
- Each bullet should be a single, concise accomplishment`;

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

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data for a SINGLE task and group activities into high-level sub-tasks.

CRITICAL: Group activities VERY STRICTLY into brief, high-level sub-task names. Each sub-task should represent a major work category, not individual actions or client-specific variations.

SPECIFIC WORK CATEGORIES (MUST FOLLOW THESE RULES):

1. FINANCIAL STATEMENTS PREPARATION - WORKPAPER CATEGORIES:
   Each workpaper category should be its OWN separate sub-task. These are the workpaper categories:
   - "Job Notes" (A2)
   - "Permanent Files" (A1)
   - "Other Checks" (A3)
   - "Financial Statements, Tax Returns & Minutes" (A4)
   - "Individuals" (A5)
   - "Bank Reconciliation" (C)
   - "Accounts Receivable" (D)
   - "Other Current Assets" (E)
   - "Inventory" (E1)
   - "Prepayments" (E2)
   - "Fixed Assets" (F)
   - "Non-Current Assets" (F1)
   - "Accounts Payable" (G)
   - "Other Current Liabilities" (H)
   - "Non-Current Liabilities" (H1)
   - "Loans" (I)
   - "Finance Lease" (I2)
   - "Operating Lease Commitments" (I3)
   - "Investments" (J)
   - "GST" (K)
   - "Income Tax" (L)
   - "Imputation Credits" (M)
   - "Imputation Credits to RE" (M2)
   - "Shareholder/Beneficiary Current Accounts" (N)
   - "Equity, Capital, Accumulations" (O)
   - "Intangibles" (P)
   - "Profit & Loss" (Q)
   - "Entertainment" (R)
   - "Home Office" (S)
   - "Wages" (W)
   
   IMPORTANT: Work on the same workpaper category for different clients should be grouped together as ONE sub-task.
   Example: "Bank Reconciliation for Client X" + "Bank Reconciliation for Client Y" = "Bank Reconciliation" (one sub-task)
   Example: "GST work for Client A" + "GST work for Client B" = "GST" (one sub-task)

2. TAX RETURNS:
   ALL tax return work (regardless of type: individual, trust, company, etc.) should be grouped as ONE sub-task: "Drafting Tax Returns"
   
   KEY INDICATORS OF TAX RETURN WORK (recognize these even if done through accounting software):
   - Window titles containing "IR3" (Individual tax return)
   - Window titles containing "Income Tax" (e.g., "2025 Income Tax", "2026 Income Tax")
   - Window titles containing "Tax Returns" or "Tax Return"
   - Window titles containing "Tax Statements"
   - PDF files with names like "Tax Docs", "IR3", or client names with tax years
   - Working in Xero Practice Manager on tax return files (even if it shows "Xero")
   - Working in Xero Workpapers when the context is tax-related
   - Any work preparing, reviewing, or processing tax returns
   - Individual tax returns (IR3, etc.)
   - Trust tax returns
   - Company tax returns
   - Work on different clients' tax returns should all be grouped together
   
   IMPORTANT: If you see "Xero" or "Xero Practice Manager" but the window title also contains "IR3", "Income Tax", "Tax Return", or similar tax-related terms, this is TAX RETURN work, NOT "Accounting Work". Only categorize as "Accounting Work" if it's general accounting/bookkeeping without tax return context.

3. OTHER WORK:
   Other types of work can be categorized as appropriate:
   - "Reviewing Trust Reports" (if reviewing completed reports, not drafting)
   - "Accounting Work" (general accounting tasks)
   - "Document Review" (reviewing documents)
   - "Email Communication" (email-related work)
   - etc.

EXAMPLES OF CORRECT GROUPING:
- "Bank Reconciliation for Client X" + "Bank Reconciliation for Client Y" → "Bank Reconciliation" (one sub-task)
- "GST work for Client A" + "GST reconciliation for Client B" → "GST" (one sub-task)
- "Accounts Receivable for Client X" → "Accounts Receivable" (one sub-task)
- "Xero Practice Manager | 2025 IR3 : Margaret Lawson" + "Xero Practice Manager | 2025 IR3 : Neville Parker" + "Margaret Lawson - 2025 - IR3 - PDF" + "Neville - Tax Docs - PDF" + "Xero Practice Manager | Margaret Lawson - 2025 Income Tax" → "Drafting Tax Returns" (ALL tax return work, even if done through Xero)
- "Xero | Reports | MM Lawson & NF Parker Family Trusts" (if this is for financial statements, not tax) → appropriate workpaper category
- "Xero Workpapers" when working on tax returns → "Drafting Tax Returns"
- "Xero Workpapers" when working on financial statements → appropriate workpaper category
- "Reviewed Trust Reports" → "Reviewing Trust Reports" (if it's review work, not drafting)
- "Accessed Xero dashboard" + "Processed invoices" + "Reconciled accounts" (general bookkeeping, no tax context) → "Accounting Work"

IMPORTANT GROUPING RULES:
- Each workpaper category should be its OWN sub-task (e.g., "Bank Reconciliation", "GST", "Accounts Receivable")
- Work on the same workpaper category for different clients should be grouped together as ONE sub-task
- ALL tax return work (regardless of client or type) = ONE sub-task: "Drafting Tax Returns"
- Client names should NOT create separate sub-tasks - group by workpaper category or work type instead
- When in doubt, group MORE rather than less - err on the side of fewer, broader sub-tasks

Your response must be formatted as a simple list of sub-tasks with time allocations:
## Sub Task Name 1 (HH:MM)
## Sub Task Name 2 (HH:MM)
## Sub Task Name 3 (HH:MM)

Rules:
- Group related activities into a SINGLE high-level sub-task name
- Use brief, descriptive names (2-4 words maximum)
- Each sub-task name should represent a major work category, NOT individual clients, specific accounts, or specific documents
- Include time spent in parentheses after each sub-task name (HH:MM format)
- Time allocations should sum to the total task duration
- Be very strict about grouping - multiple related activities should become ONE sub-task`;

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
            text: `Analyze this task's window activity and group into high-level sub-tasks:\n\n${windowActivityData}` 
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
  
  // Parse the response to extract sub-tasks
  const subTasks: Array<{ name: string; timeSpent: number }> = [];
  const lines = fullText.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('##')) {
      // Extract sub-task name and time
      const match = trimmed.match(/^##\s*(.+?)\s*\((\d{2}):(\d{2})\)/);
      if (match) {
        const name = match[1].trim();
        const hours = parseInt(match[2]);
        const minutes = parseInt(match[3]);
        const timeSpent = hours * 3600 + minutes * 60;
        subTasks.push({ name, timeSpent });
      }
    }
  }
  
  return subTasks;
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

  const systemPrompt = `You are a productivity analyst. Analyze the provided window activity data and provide a summary in a specific format.

IMPORTANT: Your response must be formatted as a markdown table with exactly 4 columns:
1. Task name
2. Total Duration (in HH:MM format)
3. Productive Time (in HH:MM format) - time spent on productive work activities
4. Achievements (bullet points only, no narrative)

Format the output as a markdown table with headers: "Task Name | Total Duration | Productive Time | Achievements"

For each task, analyze the window activity logs to:
- Calculate productive time by identifying time spent on work-related applications vs distractions
- List specific achievements as bullet points (what was accomplished, not what was done)
- Identify time lost to distractions, context switching, or non-productive activities

After the table, add a single summary sentence in this format:
"Total time spent: [X hours Y minutes], Productive time: [X hours Y minutes], Time lost: [X hours Y minutes]"

Rules:
- Use bullet points (• or -) for achievements, not narrative text
- Be specific about what was achieved (e.g., "• Completed feature X", "• Fixed bug Y")
- Calculate productive time based on application usage patterns
- Keep achievements BRIEF and concise - maximum 8-10 words per bullet point
- Focus on key accomplishments only, avoid verbose descriptions
- Use action verbs and be direct (e.g., "• Processed tax forms" not "• Reviewed and processed 2025 IR3 tax forms for both clients")
- Each bullet should be a single, concise accomplishment`;

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