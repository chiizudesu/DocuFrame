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

// Load email templates via unified template service
export async function loadEmailTemplates(): Promise<Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>> {
  const { loadEmailTemplates: load } = await import('./templateService');
  return await load();
}

// Extract structured template data (placeholders + conditions) from PDFs
export async function extractTemplateData(
  template: any,
  extractedPdfData: Record<string, string>,
  selectedAgent: AIAgent = 'claude'
): Promise<{ placeholders: Record<string, string>; conditions: Record<string, boolean> }> {
  const { extractPlaceholderNames, deriveMovementValues, formatAmountPlaceholders } = await import('./templateService');
  let result: { placeholders: Record<string, string>; conditions: Record<string, boolean> };
  switch (selectedAgent) {
    case 'openai':
      result = await openaiService.extractTemplateData(template, extractedPdfData);
      break;
    case 'claude':
      result = await claudeService.extractTemplateData(template, extractedPdfData, 'sonnet');
      break;
    case 'claude-haiku':
      result = await claudeService.extractTemplateData(template, extractedPdfData, 'haiku');
      break;
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
  const requiredPlaceholders = template.placeholders?.map((p: { name: string }) => p.name) ?? extractPlaceholderNames(template.template || '');
  const derived = deriveMovementValues(result.placeholders, requiredPlaceholders, result.conditions, result.expense_items);
  result.placeholders = derived.placeholders;
  result.conditions = { ...result.conditions, ...derived.conditions };
  formatAmountPlaceholders(result.placeholders);
  return result;
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

// Edit a template via AI instruction (streaming)
export async function editTemplateStream(
  currentTemplate: string,
  instruction: string,
  selectedAgent: AIAgent = 'claude',
  onChunk: (chunk: string) => void
): Promise<void> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.editTemplateStream(currentTemplate, instruction, onChunk);
    case 'claude':
      return await claudeService.editTemplateStream(currentTemplate, instruction, 'sonnet', onChunk);
    case 'claude-haiku':
      return await claudeService.editTemplateStream(currentTemplate, instruction, 'haiku', onChunk);
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

// Streaming version for multiple PDF document analysis
export async function analyzeMultiplePdfDocumentsStream(
  pdfFiles: Array<{ path: string; name: string; base64?: string }>,
  prompt: string,
  selectedAgent: DocumentAIAgent = 'claude',
  onChunk: (text: string) => void
): Promise<string> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.analyzeMultiplePdfDocumentsStream(pdfFiles, prompt, model, onChunk);
}

// Detect PDF table headers - scans first page, then all pages if needed
export async function detectPdfHeaders(
  pdfFilePath: string,
  fileName: string,
  selectedAgent: DocumentAIAgent = 'claude',
  scanFirstPageOnly: boolean = true,
  onProgress?: (status: string) => void
): Promise<string[]> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.detectPdfHeaders(pdfFilePath, fileName, model, scanFirstPageOnly, onProgress);
}

// Extract PDF table data based on column mappings
export async function extractPdfTableData(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] },
  selectedAgent: DocumentAIAgent = 'claude'
): Promise<Array<{ [key: string]: string }>> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.extractPdfTableData(pdfFilePath, fileName, columnMappings, model);
}

// Page-by-page extraction with progress callback
export async function extractPdfTableDataStream(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] },
  selectedAgent: DocumentAIAgent = 'claude',
  onChunk: (rows: Array<{ [key: string]: string }>) => void,
  onProgress?: (progress: { currentPage: number; totalPages: number; status: string }) => void
): Promise<Array<{ [key: string]: string }>> {
  const model = selectedAgent === 'claude-haiku' ? 'haiku' : 'sonnet';
  return await claudeService.extractPdfTableDataStream(pdfFilePath, fileName, columnMappings, model, onChunk, onProgress);
}