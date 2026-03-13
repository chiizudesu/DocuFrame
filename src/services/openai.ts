import { settingsService } from './settings';
import yaml from 'js-yaml';
import { buildExtractionPrompt } from './templateService';
import type { TemplateData, ExtractionResult } from './templateService';

const AI_EDITOR_PROMPT = `You are an expert writing assistant. When I input a raw email blurb, your task is to rewrite it using clearer, more professional, and polished language — but without making it sound robotic or overly formal. Favor a direct, confident, and forward tone over excessive politeness.\n\nMaintain the following:\n- My original tone, length, and style\n- A human and personable vibe\n- The intent and overall message of the email\n\nAvoid:\n- Adding or removing content unless needed for clarity\n- Over-sanitizing the language\n- Changing the personal feel or casual-professional balance\n\nRewrite the email blurb below accordingly.`;

export async function rewriteEmailBlurb(rawBlurb: string, customInstructions?: string): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  // Use custom instructions from parameter, fallback to settings, then default
  const prompt = customInstructions || settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const body = {
    model: 'gpt-4o-mini',
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

export async function rewriteEmailBlurbStream(
  rawBlurb: string, 
  customInstructions: string | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  // Use custom instructions from parameter, fallback to settings, then default
  const prompt = customInstructions || settings.aiEditorInstructions || AI_EDITOR_PROMPT;

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: rawBlurb }
    ],
    max_tokens: 800,
    temperature: 0.7,
    stream: true
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

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch (e) {
          console.error('Failed to parse streaming chunk:', e);
        }
      }
    }
  }
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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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

  const PLACEHOLDER_ANALYSIS_PROMPT = `You are an expert template analyzer. Analyze the following document text and identify:
A) VALUE PLACEHOLDERS - values that should be made dynamic (use type "placeholder")
B) CONDITIONAL BLOCKS - mutually exclusive paragraphs or alternatives (use type "condition")

For VALUE PLACEHOLDERS, look for:
1. Personal Information: names, addresses, emails, phone numbers
2. Financial Data: amounts, percentages, account numbers, tax years
3. Dates: any date formats
4. Business Data: company names, reference numbers, invoice numbers
5. Legal/Tax: IRD numbers, GST numbers, case numbers
6. Context-Specific Values: anything that would change between uses

For CONDITIONAL BLOCKS, look for:
- "OR" blocks (mutually exclusive paragraph alternatives)
- Slash alternatives (e.g. "refund of X / has tax to pay of X")
- Bracket comments like "[if no comparatives]", "[if X]"
- Text that indicates one of several paths based on document content

For conditions, suggest boolean-style names: has_comparatives, has_refund, is_provisional_taxpayer, no_comparatives, etc.

Return your analysis as a JSON array. Each item must have "type" ("placeholder" or "condition"), "original", "suggested", "accepted":
[
  { "type": "placeholder", "original": "exact text", "suggested": "variable_name", "accepted": true },
  { "type": "condition", "original": "OR block or alternative text", "suggested": "condition_name", "accepted": true }
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
    max_tokens: 8192,
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
    let jsonStr = content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = parsePartialPlaceholderJson(jsonStr);
    }
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (!Array.isArray(parsed)) throw new Error('AI response is not an array');

    return parsed
      .filter((p: any) => p.original && p.suggested && typeof p.accepted === 'boolean')
      .map((p: any) => ({
        type: p.type === 'condition' ? 'condition' : 'placeholder',
        original: p.original,
        suggested: p.suggested,
        accepted: p.accepted
      }));
  } catch (parseError) {
    console.error('Failed to parse AI placeholder analysis:', content);
    throw new Error('AI returned invalid format for placeholder analysis');
  }
}

function parsePartialPlaceholderJson(jsonStr: string): any[] {
  const arr: any[] = [];
  const objRegex = /\{\s*"type"\s*:\s*"(placeholder|condition)"\s*,\s*"original"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"suggested"\s*:\s*"([^"]*)"\s*,\s*"accepted"\s*:\s*(true|false)\s*\}/g;
  let m;
  while ((m = objRegex.exec(jsonStr)) !== null) {
    const original = m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    arr.push({ type: m[1], original, suggested: m[3], accepted: m[4] === 'true' });
  }
  if (arr.length > 0) return arr;
  throw new Error('Could not extract valid objects from truncated JSON');
}

export async function loadEmailTemplates(): Promise<Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>> {
  const { loadEmailTemplates: load } = await import('./templateService');
  return await load();
}

export async function extractTemplateData(
  template: TemplateData,
  extractedPdfData: Record<string, string>
): Promise<ExtractionResult> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  const prompt = buildExtractionPrompt(template, extractedPdfData);

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nExtract the data and return only the JSON object.`
      }
    ],
    max_tokens: 2000,
    temperature: 0.2
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get response from OpenAI');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  return parseExtractionResult(content);
}

function parseExtractionResult(content: string): ExtractionResult {
  // Strip markdown code blocks if present
  let jsonStr = content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const placeholders: Record<string, string> =
      typeof parsed.placeholders === 'object' && parsed.placeholders !== null
        ? Object.fromEntries(
            Object.entries(parsed.placeholders).map(([k, v]) => [
              k,
              String(v ?? '')
            ])
          )
        : {};
    const conditions: Record<string, boolean> =
      typeof parsed.conditions === 'object' && parsed.conditions !== null
        ? Object.fromEntries(
            Object.entries(parsed.conditions).map(([k, v]) => [
              k,
              Boolean(v)
            ])
          )
        : {};
    const expense_items = Array.isArray(parsed.expense_items)
      ? parsed.expense_items
          .filter(
            (x: any) =>
              x && typeof x.name === 'string' && (x.prior != null || x.current != null)
          )
          .map((x: any) => ({
            name: String(x.name ?? ''),
            prior: String(x.prior ?? ''),
            current: String(x.current ?? '')
          }))
      : undefined;
    return { placeholders, conditions, expense_items };
  } catch (e) {
    console.error('Failed to parse extraction result:', content);
    throw new Error('AI returned invalid JSON for template data extraction');
  }
}

// Streaming version for email template generation
export async function generateEmailFromTemplateStream(
  template: any,
  extractedData: { [key: string]: string },
  onChunk: (text: string) => void
): Promise<string> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  // Prepare prompt for OpenAI
  const prompt = `You are an expert accountant. Given the following extracted text from PDFs, fill in the placeholders in the provided email template. Only use information found in the PDFs.\n\nExtracted Data:\n${Object.entries(extractedData).map(([cat, text]) => `--- ${cat} ---\n${text || ''}`).join('\n')}\n\nTemplate:\n${template.template}`;

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: `${prompt}\n\nFill in the template with the extracted data.` }
    ],
    max_tokens: 800,
    temperature: 0.7,
    stream: true
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

  let fullText = '';
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Failed to get response stream from OpenAI');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON chunks
            console.warn('Failed to parse streaming chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText.trim();
}

const TEMPLATE_EDIT_PROMPT = `You are a template editor. You will receive an email template that uses {{placeholder}} syntax for variable values and {{#if condition}}...{{#else}}...{{/if}} syntax for conditional blocks.

The user will give you an editing instruction. Apply the instruction to the template and return ONLY the updated template text. Preserve all existing {{placeholder}} and {{#if}} syntax exactly unless the instruction specifically asks to change them. Do not add any explanation or markdown formatting — output the raw template only.

EXTRACTION & DERIVED VALUES (use these when adding/editing financial comparative sections):
Placeholders are filled from PDF extraction. Movement/direction/percent are derived from current vs prior year amounts. Use these standard patterns:
- Revenue: revenue_2024, revenue_2025 (or revenue_prior, revenue_current) → derived: revenue_change_direction ("increase"/"decrease"), revenue_change_percent
- Overheads: overheads_2024, overheads_2025 (or overheads_prior, overheads_current) → derived: overheads_direction, overheads_movement (absolute $), overheads_movement_percent
- Gross profit: gross_profit_2024, gross_profit_2025 → derived: gross_profit_direction
- Expenses (1–7): expenses_N_2024, expenses_N_2025 (or expenses_N_prior, expenses_N_current) for each line → derived: expenses_N_amount (movement $), expenses_N_percent, and condition expenses_N_increased (for {{#if expenses_N_increased}}increased{{#else}}decreased{{/if}})
- Category names: expenses_1 through expenses_7 hold the expense label (e.g. "Salaries").`;

export async function editTemplateStream(
  currentTemplate: string,
  instruction: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not set.');

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: TEMPLATE_EDIT_PROMPT },
      { role: 'user', content: `TEMPLATE:\n${currentTemplate}\n\nINSTRUCTION:\n${instruction}` }
    ],
    max_tokens: 8192,
    temperature: 0.3,
    stream: true
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
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            // skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}