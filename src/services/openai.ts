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