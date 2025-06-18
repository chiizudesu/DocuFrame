import { settingsService } from './settings';
import yaml from 'js-yaml';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

export async function rewriteEmailBlurb(rawBlurb: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: AI_EDITOR_PROMPT },
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

  const INSIGHTS_PROMPT = `You are a professional document analyzer. Analyze the following document and provide key insights that would be useful for business, tax, or legal purposes. Focus on:

1. **Document Type & Purpose**: What type of document is this and what is its main purpose?
2. **Key Financial Information**: Any important financial figures, dates, or calculations
3. **Important Dates**: Critical deadlines, periods, or time-sensitive information
4. **Action Items**: Any tasks, requirements, or next steps mentioned
5. **Notable Details**: Any unusual, important, or attention-worthy information

Keep your analysis concise but comprehensive. Format your response with clear headings and bullet points for easy scanning.

Document to analyze:`;

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: INSIGHTS_PROMPT },
      { role: 'user', content: `Document: ${fileName}\n\nContent:\n${documentText}` }
    ],
    max_tokens: 1200,
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
  return data.choices?.[0]?.message?.content?.trim() || '';
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

export async function loadEmailTemplates(): Promise<Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>> {
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