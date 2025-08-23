import { settingsService } from './settings';
import Anthropic from '@anthropic-ai/sdk';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

export async function rewriteEmailBlurb(rawBlurb: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  // Use custom instructions from settings, fallback to default if not set
  const prompt = settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 800,
    messages: [
      { role: 'user', content: `${prompt}\n\n${rawBlurb}` }
    ],
    temperature: 0.7
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

export async function extractDocumentInsights(documentText: string, fileName: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set.');

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  console.log('=== CLAUDE SERVICE ===');
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

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1200,
    messages: [
      { role: 'user', content: messageContent }
    ],
    temperature: 0.3
  });

  const content = response.content[0];
  if (content.type === 'text') {
    console.log('Claude response length:', content.text.length);
    console.log('Claude response preview:', content.text.substring(0, 200));
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
}

export async function analyzeTemplateForPlaceholders(templateText: string, templateName: string): Promise<Array<{original: string, suggested: string, accepted: boolean}>> {
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

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    messages: [
      { role: 'user', content: `${PLACEHOLDER_ANALYSIS_PROMPT}\n\n${templateText}` }
    ],
    temperature: 0.3
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
  extractedData: { [key: string]: string }
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

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 800,
    messages: [
      { role: 'user', content: `${prompt}\n\nFill in the template with the extracted data.` }
    ],
    temperature: 0.7
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }
  
  throw new Error('Unexpected response format from Claude');
} 