import * as openaiService from './openai';
import * as claudeService from './claude';

// Define available AI agents
export const AI_AGENTS = [
  {
    value: 'openai' as const,
    label: 'OpenAI GPT-4',
    description: 'Fast and reliable for most tasks'
  },
  {
    value: 'claude' as const,
    label: 'Claude 3.5 Sonnet',
    description: 'Excellent for detailed analysis and reasoning'
  }
];

export type AIAgent = typeof AI_AGENTS[number]['value'];



// Unified function to analyze templates for placeholders
export async function analyzeTemplateForPlaceholders(
  templateText: string, 
  templateName: string, 
  selectedAgent: AIAgent = 'openai'
): Promise<Array<{original: string, suggested: string, accepted: boolean}>> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.analyzeTemplateForPlaceholders(templateText, templateName);
    case 'claude':
      return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Unified function to generate email from template
export async function generateEmailFromTemplate(
  template: any,
  extractedData: { [key: string]: string },
  selectedAgent: AIAgent = 'claude'
): Promise<string> {
  switch (selectedAgent) {
    case 'claude':
      return await claudeService.generateEmailFromTemplate(template, extractedData);
    case 'openai':
      // OpenAI service doesn't have this function yet, so we'll use Claude as fallback
      return await claudeService.generateEmailFromTemplate(template, extractedData);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Load email templates (currently only available in OpenAI service)
export async function loadEmailTemplates(): Promise<Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>> {
  return await openaiService.loadEmailTemplates();
}

// Rewrite email blurb function
export async function rewriteEmailBlurb(
  rawBlurb: string, 
  selectedAgent: AIAgent = 'openai'
): Promise<string> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.rewriteEmailBlurb(rawBlurb);
    case 'claude':
      return await claudeService.rewriteEmailBlurb(rawBlurb);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Unified function to extract document insights
export async function extractDocumentInsights(
  documentText: string, 
  fileName: string, 
  selectedAgent: AIAgent = 'openai'
): Promise<string> {
  console.log('=== AI SERVICE WRAPPER ===');
  console.log('Selected agent:', selectedAgent);
  console.log('Document text length:', documentText.length);
  console.log('File name:', fileName);

  switch (selectedAgent) {
    case 'openai':
      return await openaiService.extractDocumentInsights(documentText, fileName);
    case 'claude':
      return await claudeService.extractDocumentInsights(documentText, fileName);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}