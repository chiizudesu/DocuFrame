import * as openaiService from './openai';
import * as claudeService from './claude';

// Define available AI agents (for AI Editor, Templater, etc.)
export const AI_AGENTS = [
  {
    value: 'openai' as const,
    label: 'OpenAI GPT-4o',
    description: 'Fast and reliable for most tasks'
  },
  {
    value: 'claude' as const,
    label: 'Claude Sonnet 4.5',
    description: 'Excellent for detailed analysis and reasoning'
  },
  {
    value: 'claude-haiku' as const,
    label: 'Claude Haiku 4.5',
    description: 'Fast and cost-effective for quick analysis'
  }
];

// Define available AI agents specifically for document analysis (Claude only)
export const DOCUMENT_AI_AGENTS = [
  {
    value: 'claude' as const,
    label: 'Claude Sonnet 4.5',
    description: 'Excellent for detailed analysis and reasoning'
  },
  {
    value: 'claude-haiku' as const,
    label: 'Claude Haiku 4.5',
    description: 'Fast and cost-effective for quick analysis'
  }
];

export type AIAgent = typeof AI_AGENTS[number]['value'];
export type DocumentAIAgent = typeof DOCUMENT_AI_AGENTS[number]['value'];



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
      return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName, 'sonnet');
    case 'claude-haiku':
      return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName, 'haiku');
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
      return await claudeService.generateEmailFromTemplate(template, extractedData, 'sonnet');
    case 'claude-haiku':
      return await claudeService.generateEmailFromTemplate(template, extractedData, 'haiku');
    case 'openai':
      // OpenAI service doesn't have this function yet, so we'll use Claude as fallback
      return await claudeService.generateEmailFromTemplate(template, extractedData, 'sonnet');
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Streaming version of generateEmailFromTemplate
export async function generateEmailFromTemplateStream(
  template: any,
  extractedData: { [key: string]: string },
  selectedAgent: AIAgent = 'claude',
  onChunk: (text: string) => void
): Promise<string> {
  switch (selectedAgent) {
    case 'claude':
      return await claudeService.generateEmailFromTemplateStream(template, extractedData, 'sonnet', onChunk);
    case 'claude-haiku':
      return await claudeService.generateEmailFromTemplateStream(template, extractedData, 'haiku', onChunk);
    case 'openai':
      return await openaiService.generateEmailFromTemplateStream(template, extractedData, onChunk);
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
  selectedAgent: AIAgent = 'openai',
  customInstructions?: string
): Promise<string> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.rewriteEmailBlurb(rawBlurb, customInstructions);
    case 'claude':
      return await claudeService.rewriteEmailBlurb(rawBlurb, 'sonnet', customInstructions);
    case 'claude-haiku':
      return await claudeService.rewriteEmailBlurb(rawBlurb, 'haiku', customInstructions);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Rewrite email blurb function with streaming
export async function rewriteEmailBlurbStream(
  rawBlurb: string, 
  selectedAgent: AIAgent = 'openai',
  customInstructions: string | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.rewriteEmailBlurbStream(rawBlurb, customInstructions, onChunk);
    case 'claude':
      return await claudeService.rewriteEmailBlurbStream(rawBlurb, 'sonnet', customInstructions, onChunk);
    case 'claude-haiku':
      return await claudeService.rewriteEmailBlurbStream(rawBlurb, 'haiku', customInstructions, onChunk);
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Unified function to extract document insights (legacy - for text-based analysis)
// For PDF analysis, use analyzePdfDocument instead
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
      return await claudeService.extractDocumentInsights(documentText, fileName, 'sonnet');
    case 'claude-haiku':
      return await claudeService.extractDocumentInsights(documentText, fileName, 'haiku');
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// New function specifically for PDF document analysis (Claude only)
export async function analyzePdfDocument(
  pdfFilePath: string,
  fileName: string,
  prompt: string,
  selectedAgent: DocumentAIAgent = 'claude'
): Promise<string> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.analyzePdfDocument(pdfFilePath, fileName, prompt, model);
}

// Streaming version for PDF document analysis
export async function analyzePdfDocumentStream(
  pdfFilePath: string,
  fileName: string,
  prompt: string,
  selectedAgent: DocumentAIAgent = 'claude',
  onChunk: (text: string) => void
): Promise<string> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.analyzePdfDocumentStream(pdfFilePath, fileName, prompt, model, onChunk);
}