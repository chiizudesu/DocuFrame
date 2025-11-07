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
    value: 'claude-sonnet' as const,
    label: 'Claude Sonnet 4.5',
    description: 'Most capable Claude model, excellent for complex reasoning'
  },
  {
    value: 'claude-haiku' as const,
    label: 'Claude 3.5 Haiku',
    description: 'Faster and more cost-effective Claude model'
  }
];

export type AIAgent = typeof AI_AGENTS[number]['value'];

// Type definitions for enhanced templates
export interface ExtractionField {
  name: string;
  instruction: string;
}

export interface CategoryConfig {
  description: string;
  extractions: ExtractionField[];
}

export interface EnhancedTemplate {
  name: string;
  description: string;
  categories: { [key: string]: CategoryConfig } | string[]; // Support both old and new formats
  template: string;
  filename?: string;
}



// Unified function to analyze templates for placeholders
export async function analyzeTemplateForPlaceholders(
  templateText: string, 
  templateName: string, 
  selectedAgent: AIAgent = 'openai'
): Promise<Array<{original: string, suggested: string, accepted: boolean}>> {
  switch (selectedAgent) {
    case 'openai':
      return await openaiService.analyzeTemplateForPlaceholders(templateText, templateName);
    case 'claude-sonnet':
      return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName, 'claude-sonnet');
    case 'claude-haiku':
      return await claudeService.analyzeTemplateForPlaceholders(templateText, templateName, 'claude-haiku');
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}

// Extract structured data from a document based on extraction instructions
export async function extractStructuredData(
  documentText: string,
  extractions: ExtractionField[],
  categoryName: string,
  selectedAgent: AIAgent = 'claude-sonnet'
): Promise<{ [key: string]: string }> {
  // Build extraction prompt
  const extractionPrompt = `You are an expert accountant analyzing a ${categoryName} document. Extract the following specific data points from the document text.

For each field, follow the instruction carefully and return ONLY the requested information.

Document Text:
${documentText}

---

Extract the following fields:

${extractions.map((field, idx) => `${idx + 1}. **${field.name}**: ${field.instruction}`).join('\n\n')}

---

Return your response as a JSON object with the field names as keys and the extracted values as values.
Example format:
{
  "field_name_1": "extracted value 1",
  "field_name_2": "extracted value 2"
}

IMPORTANT: Return ONLY valid JSON, no explanations or markdown formatting.`;

  let response: string;
  
  switch (selectedAgent) {
    case 'claude-sonnet':
      response = await claudeService.extractStructuredData(extractionPrompt, 'claude-sonnet');
      break;
    case 'claude-haiku':
      response = await claudeService.extractStructuredData(extractionPrompt, 'claude-haiku');
      break;
    case 'openai':
      response = await openaiService.extractStructuredData(extractionPrompt);
      break;
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }

  // Parse JSON response
  try {
    // Clean up response if it has markdown code blocks
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }
    
    return JSON.parse(cleanedResponse);
  } catch (err) {
    console.error('Failed to parse structured extraction response:', response);
    throw new Error('AI returned invalid JSON format. Please try again.');
  }
}

// Check if template uses enhanced two-stage format
function isEnhancedTemplate(template: EnhancedTemplate): boolean {
  return typeof template.categories === 'object' && !Array.isArray(template.categories);
}

// Unified function to generate email from template (supports both old and new formats)
export async function generateEmailFromTemplate(
  template: EnhancedTemplate,
  extractedData: { [key: string]: string },
  selectedAgent: AIAgent = 'claude-sonnet',
  onProgress?: (message: string) => void
): Promise<string> {
  // Check if this is an enhanced template with structured extractions
  if (isEnhancedTemplate(template)) {
    onProgress?.('🔍 Starting two-stage extraction...');
    
    // Stage 1: Extract structured data from each document
    const structuredData: { [key: string]: any } = {};
    const categories = template.categories as { [key: string]: CategoryConfig };
    
    for (const [categoryName, categoryConfig] of Object.entries(categories)) {
      if (!extractedData[categoryName]) {
        throw new Error(`No document provided for category: ${categoryName}`);
      }
      
      onProgress?.(`📄 Extracting data from ${categoryName}...`);
      
      const extracted = await extractStructuredData(
        extractedData[categoryName],
        categoryConfig.extractions,
        categoryName,
        selectedAgent
      );
      
      // Merge extracted data
      Object.assign(structuredData, extracted);
    }
    
    onProgress?.('✨ Generating email from extracted data...');
    
    // Stage 2: Fill template with structured data
    let email = template.template;
    for (const [key, value] of Object.entries(structuredData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      email = email.replace(regex, String(value));
    }
    
    // Clean up any remaining unfilled placeholders
    email = email.replace(/\{\{[^}]+\}\}/g, '[data not found]');
    
    return email;
  } else {
    // Legacy format: use old single-stage extraction
    onProgress?.('Generating email (legacy mode)...');
    
    switch (selectedAgent) {
      case 'claude-sonnet':
        return await claudeService.generateEmailFromTemplate(template, extractedData, 'claude-sonnet');
      case 'claude-haiku':
        return await claudeService.generateEmailFromTemplate(template, extractedData, 'claude-haiku');
      case 'openai':
        return await claudeService.generateEmailFromTemplate(template, extractedData, 'claude-sonnet');
      default:
        throw new Error(`Unknown AI agent: ${selectedAgent}`);
    }
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
    case 'claude-sonnet':
      return await claudeService.rewriteEmailBlurb(rawBlurb, 'claude-sonnet');
    case 'claude-haiku':
      return await claudeService.rewriteEmailBlurb(rawBlurb, 'claude-haiku');
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
    case 'claude-sonnet':
      return await claudeService.extractDocumentInsights(documentText, fileName, 'claude-sonnet');
    case 'claude-haiku':
      return await claudeService.extractDocumentInsights(documentText, fileName, 'claude-haiku');
    default:
      throw new Error(`Unknown AI agent: ${selectedAgent}`);
  }
}