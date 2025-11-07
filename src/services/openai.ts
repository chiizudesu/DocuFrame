import { settingsService } from './settings';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

export async function rewriteEmailBlurb(rawBlurb: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  // Use custom instructions from settings, fallback to default if not set
  const prompt = settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: rawBlurb }
    ],
    max_tokens: 800,
    temperature: 0.7
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get response from OpenAI');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function extractDocumentInsights(documentText: string, fileName: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  console.log('=== OPENAI SERVICE ===');
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

  let body: any;

  if (isCustomPrompt) {
    // This is already a formatted prompt with custom instructions, use it directly
    console.log('Using custom prompt directly');
    
    // Check if this is a table-related request and enhance the prompt
    const isTableRequest = documentText.toLowerCase().includes('table') || 
                          documentText.toLowerCase().includes('spreadsheet') || 
                          documentText.toLowerCase().includes('extract data') ||
                          documentText.toLowerCase().includes('convert');
                          
    let finalContent = documentText;
    if (isTableRequest && !documentText.includes('IMPORTANT: When presenting tabular data')) {
      // Add table formatting instructions if not already present
      finalContent = documentText + `

ADDITIONAL INSTRUCTION: If your response contains structured data, present it as a proper markdown table using | symbols for columns and --- for separators. Example:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |`;
    }
    
    body = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: finalContent }
      ],
      max_tokens: 1200,
      temperature: 0.3
    };
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

    body = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: INSIGHTS_PROMPT },
        { role: 'user', content: `Document: ${fileName}\n\nContent:\n${documentText}` }
      ],
      max_tokens: 1200,
      temperature: 0.3
    };
  }

  console.log('Request body messages length:', body.messages.length);
  console.log('Request body preview:', JSON.stringify(body.messages[0]).substring(0, 200));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get response from OpenAI');
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim() || '';
  
  console.log('OpenAI response length:', result.length);
  console.log('OpenAI response preview:', result.substring(0, 200));
  
  return result;
}

export async function analyzeTemplateForPlaceholders(templateText: string, templateName: string): Promise<Array<{original: string, suggested: string, accepted: boolean}>> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

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

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PLACEHOLDER_ANALYSIS_PROMPT },
      { role: 'user', content: templateText }
    ],
    max_tokens: 1500,
    temperature: 0.3
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get response from OpenAI');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  
  try {
    // Parse the JSON response
    const placeholders = JSON.parse(content);
    
    // Validate the response format
    if (!Array.isArray(placeholders)) {
      throw new Error('AI response is not an array');
    }
    
    return placeholders.filter((p: any) => 
      p.original && p.suggested && typeof p.accepted === 'boolean'
    );
  } catch (parseError) {
    console.error('Failed to parse AI placeholder analysis:', content);
    throw new Error('AI returned invalid format for placeholder analysis');
  }
}

// Extract structured data using targeted prompts
export async function extractStructuredData(extractionPrompt: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: extractionPrompt }
    ],
    max_tokens: 2000,
    temperature: 0.2  // Lower temperature for more accurate extraction
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get response from OpenAI');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function loadEmailTemplates(): Promise<Array<{ name: string; description: string; categories: string[] | {[key: string]: any}; template: string; filename: string }>> {
  const folder = await settingsService.getTemplateFolderPath();
  if (!folder) throw new Error('Template folder path not set.');
  const files = await (window.electronAPI as any).getDirectoryContents(folder);
  const yamlFiles = files.filter((f: any) => f.name.endsWith('.yaml') || f.name.endsWith('.yml'));
  const templates = [];
  for (const file of yamlFiles) {
    const data = await (window.electronAPI as any).loadYamlTemplate(`${folder}/${file.name}`);
    if (data && data.name && data.template) {
      templates.push({
        name: data.name,
        description: data.description || '',
        categories: data.categories || [],
        template: data.template,
        filename: file.name
      });
    }
  }
  return templates;
} 