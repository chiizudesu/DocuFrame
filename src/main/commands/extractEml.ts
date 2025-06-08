import * as fs from 'fs';
import * as path from 'path';

interface ParsedEmail {
  headers: { [key: string]: string };
  body: string;
  attachments: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
}

export async function extractEml(currentDirectory: string, singleFile?: string): Promise<{ success: boolean; message: string; extractedFiles: string[] }> {
  try {
    console.log('[ExtractEml] Starting extraction in:', currentDirectory);
    
    // Determine which EML files to process
    let emlFiles: string[];
    if (singleFile) {
      // Single file extraction
      if (!singleFile.toLowerCase().endsWith('.eml')) {
        return {
          success: false,
          message: 'Selected file is not an EML file',
          extractedFiles: []
        };
      }
      if (!fs.existsSync(path.join(currentDirectory, singleFile))) {
        return {
          success: false,
          message: `EML file not found: ${singleFile}`,
          extractedFiles: []
        };
      }
      emlFiles = [singleFile];
    } else {
      // Extract all EML files in the directory
      const files = fs.readdirSync(currentDirectory);
      emlFiles = files.filter(file => file.toLowerCase().endsWith('.eml'));
      
      if (emlFiles.length === 0) {
        return {
          success: false,
          message: 'No EML files found in current directory',
          extractedFiles: []
        };
      }
    }
    
    console.log(`[ExtractEml] Found ${emlFiles.length} EML file(s):`, emlFiles);
    
    const extractedFiles: string[] = [];
    const errors: string[] = [];
    
    for (const emlFile of emlFiles) {
      try {
        const emlPath = path.join(currentDirectory, emlFile);
        console.log(`[ExtractEml] Processing: ${emlFile}`);
        
        // Read the EML file
        const emlContent = fs.readFileSync(emlPath, 'utf8');
        
        // Parse the email
        const email = parseEmlContent(emlContent);
        
        if (email.attachments.length === 0) {
          console.log(`[ExtractEml] No attachments found in: ${emlFile}`);
          continue;
        }
        
        // Extract each attachment
        for (const attachment of email.attachments) {
          try {
            // Clean filename
            let filename = attachment.filename || 'attachment';
            filename = filename.replace(/[<>:"/\\|?*]/g, '_'); // Remove invalid filename characters
            
            // Create unique filename if it already exists
            let outputPath = path.join(currentDirectory, filename);
            let counter = 1;
            while (fs.existsSync(outputPath)) {
              const ext = path.extname(filename);
              const name = path.basename(filename, ext);
              outputPath = path.join(currentDirectory, `${name}_${counter}${ext}`);
              counter++;
            }
            
            // Write attachment to file
            fs.writeFileSync(outputPath, attachment.content);
            extractedFiles.push(path.basename(outputPath));
            console.log(`[ExtractEml] Extracted: ${path.basename(outputPath)} from ${emlFile}`);
            
          } catch (error) {
            console.error(`[ExtractEml] Failed to extract attachment from ${emlFile}:`, error);
            errors.push(`Failed to extract attachment from ${emlFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
      } catch (error) {
        console.error(`[ExtractEml] Error processing ${emlFile}:`, error);
        errors.push(`Failed to process ${emlFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Prepare result message
    let message = `Processed ${emlFiles.length} EML file(s). `;
    if (extractedFiles.length > 0) {
      message += `Successfully extracted ${extractedFiles.length} attachment(s).`;
    } else if (errors.length === 0) {
      message += `No attachments found in the processed EML file(s).`;
    }
    if (errors.length > 0) {
      message += `\n\nErrors encountered:\n${errors.join('\n')}`;
    }
    
    return {
      success: errors.length === 0, // Success if no errors, even if no attachments found
      message,
      extractedFiles
    };
    
  } catch (error) {
    console.error('[ExtractEml] Unexpected error:', error);
    return {
      success: false,
      message: `EML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      extractedFiles: []
    };
  }
}

function parseEmlContent(emlContent: string): ParsedEmail {
  const lines = emlContent.split('\n');
  const headers: { [key: string]: string } = {};
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  
  let currentSection = 'headers';
  let currentHeader = '';
  let currentValue = '';
  let body = '';
  let boundary = '';
  
  // Parse headers first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (currentSection === 'headers') {
      if (line.trim() === '') {
        // End of headers
        if (currentHeader) {
          headers[currentHeader.toLowerCase()] = currentValue.trim();
        }
        currentSection = 'body';
        continue;
      }
      
      if (line.match(/^[A-Za-z-]+:/)) {
        // New header
        if (currentHeader) {
          headers[currentHeader.toLowerCase()] = currentValue.trim();
        }
        const colonIndex = line.indexOf(':');
        currentHeader = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      } else {
        // Continuation of previous header
        currentValue += ' ' + line.trim();
      }
    } else {
      body += line + '\n';
    }
  }
  
  // Add last header if any
  if (currentHeader && currentSection === 'headers') {
    headers[currentHeader.toLowerCase()] = currentValue.trim();
  }
  
  // Extract boundary from content-type header
  const contentType = headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);
  if (boundaryMatch) {
    boundary = '--' + boundaryMatch[1];
  }
  
  // Parse multipart content for attachments
  if (boundary && body.includes(boundary)) {
    const parts = body.split(boundary);
    
    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      
      const partLines = part.split('\n');
      const partHeaders: { [key: string]: string } = {};
      let partBody = '';
      let inHeaders = true;
      
      // Parse part headers
      for (const line of partLines) {
        if (inHeaders) {
          if (line.trim() === '') {
            inHeaders = false;
            continue;
          }
          
          if (line.match(/^[A-Za-z-]+:/)) {
            const colonIndex = line.indexOf(':');
            const headerName = line.substring(0, colonIndex).trim().toLowerCase();
            const headerValue = line.substring(colonIndex + 1).trim();
            partHeaders[headerName] = headerValue;
          }
        } else {
          partBody += line + '\n';
        }
      }
      
      // Check if this part is an attachment
      const disposition = partHeaders['content-disposition'] || '';
      const isAttachment = disposition.toLowerCase().includes('attachment');
      
      if (isAttachment) {
        // Extract filename
        const filenameMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
        const filename = filenameMatch ? filenameMatch[1] : 'attachment';
        
        // Decode content based on encoding
        const encoding = partHeaders['content-transfer-encoding'] || '';
        let content: Buffer;
        
        if (encoding.toLowerCase() === 'base64') {
          try {
            content = Buffer.from(partBody.replace(/\s/g, ''), 'base64');
          } catch {
            content = Buffer.from(partBody, 'utf8');
          }
        } else {
          content = Buffer.from(partBody, 'utf8');
        }
        
        attachments.push({
          filename,
          content,
          contentType: partHeaders['content-type'] || 'application/octet-stream'
        });
      }
    }
  }
  
  return {
    headers,
    body: body.trim(),
    attachments
  };
} 