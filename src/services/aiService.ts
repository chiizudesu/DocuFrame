import * as claudeService from './claude';
import type { ExpenseItem } from './templateService';

// Unified function to analyze templates for placeholders (Claude Sonnet)
export async function analyzeTemplateForPlaceholders(
  templateText: string,
  templateName: string
): Promise<Array<{ original: string; suggested: string; accepted: boolean }>> {
  return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName, 'sonnet');
}

export async function generateEmailFromTemplate(
  template: any,
  extractedData: { [key: string]: string }
): Promise<string> {
  return await claudeService.generateEmailFromTemplate(template, extractedData, 'sonnet');
}

export async function generateEmailFromTemplateStream(
  template: any,
  extractedData: { [key: string]: string },
  onChunk: (text: string) => void
): Promise<string> {
  return await claudeService.generateEmailFromTemplateStream(template, extractedData, 'sonnet', onChunk);
}

export async function loadEmailTemplates(): Promise<
  Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>
> {
  const { loadEmailTemplates: load } = await import('./templateService');
  return await load();
}

export async function extractTemplateData(
  template: any,
  extractedPdfData: Record<string, string>
): Promise<{ placeholders: Record<string, string>; conditions: Record<string, boolean> }> {
  const { extractPlaceholderNames, deriveMovementValues, formatAmountPlaceholders } = await import('./templateService');
  const result = await claudeService.extractTemplateData(template, extractedPdfData, 'sonnet');
  const requiredPlaceholders = template.placeholders?.map((p: { name: string }) => p.name) ?? extractPlaceholderNames(template.template || '');
  const expenseItems = (result as { expense_items?: ExpenseItem[] }).expense_items;
  const derived = deriveMovementValues(result.placeholders, requiredPlaceholders, result.conditions, expenseItems);
  result.placeholders = derived.placeholders;
  result.conditions = { ...result.conditions, ...derived.conditions };
  formatAmountPlaceholders(result.placeholders);
  return result;
}

export async function rewriteEmailBlurb(rawBlurb: string, customInstructions?: string): Promise<string> {
  return await claudeService.rewriteEmailBlurb(rawBlurb, 'sonnet', customInstructions);
}

export async function rewriteEmailBlurbStream(
  rawBlurb: string,
  customInstructions: string | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  return await claudeService.rewriteEmailBlurbStream(rawBlurb, 'sonnet', customInstructions, onChunk);
}

export async function editTemplateStream(
  currentTemplate: string,
  instruction: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  return await claudeService.editTemplateStream(currentTemplate, instruction, 'sonnet', onChunk);
}

export async function extractDocumentInsights(documentText: string, fileName: string): Promise<string> {
  console.log('=== AI SERVICE WRAPPER ===');
  console.log('Document text length:', documentText.length);
  console.log('File name:', fileName);
  return await claudeService.extractDocumentInsights(documentText, fileName, 'sonnet');
}

export async function analyzePdfDocument(pdfFilePath: string, fileName: string, prompt: string): Promise<string> {
  return await claudeService.analyzePdfDocument(pdfFilePath, fileName, prompt, 'sonnet');
}

export async function analyzePdfDocumentStream(
  pdfFilePath: string,
  fileName: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  return await claudeService.analyzePdfDocumentStream(pdfFilePath, fileName, prompt, 'sonnet', onChunk);
}

export async function analyzeMultiplePdfDocumentsStream(
  pdfFiles: Array<{ path: string; name: string; base64?: string }>,
  prompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  return await claudeService.analyzeMultiplePdfDocumentsStream(pdfFiles, prompt, 'sonnet', onChunk);
}

export async function detectPdfHeaders(
  pdfFilePath: string,
  fileName: string,
  scanFirstPageOnly: boolean = true,
  onProgress?: (status: string) => void
): Promise<string[]> {
  return await claudeService.detectPdfHeaders(pdfFilePath, fileName, 'sonnet', scanFirstPageOnly, onProgress);
}

export async function extractPdfTableData(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] }
): Promise<Array<{ [key: string]: string }>> {
  return await claudeService.extractPdfTableData(pdfFilePath, fileName, columnMappings, 'sonnet');
}

export async function extractPdfTableDataStream(
  pdfFilePath: string,
  fileName: string,
  columnMappings: { [fixedColumn: string]: string[] },
  onChunk: (rows: Array<{ [key: string]: string }>) => void,
  onProgress?: (progress: { currentPage: number; totalPages: number; status: string }) => void
): Promise<Array<{ [key: string]: string }>> {
  return await claudeService.extractPdfTableDataStream(pdfFilePath, fileName, columnMappings, 'sonnet', onChunk, onProgress);
}
