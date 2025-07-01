import { transferFiles } from './commands/transfer';
import { finalsCommand } from './commands/finalsCommand';
import { gstRenameCommand } from './commands/gstRename';
import { mergePdfs } from './commands/mergePdfs';
import { extractZips } from './commands/extractZips';
import { extractEml } from './commands/extractEml';
import { gstTemplate } from './commands/gstTemplate';
import { updateApp } from './commands/updateApp';
import { getConfig } from './config';

interface CommandResult {
  success: boolean;
  message: string;
  files?: any[];
}

export async function handleCommand(command: string, args: string[], currentDirectory?: string, options?: any): Promise<CommandResult> {
  console.log('[CommandHandler] Handling command:', command, 'with args:', args, 'currentDirectory:', currentDirectory);
  
  // Get command name and arguments
  const [cmd, ...cmdArgs] = command.split(' ');
  console.log('[CommandHandler] Parsed command:', cmd, 'with args:', cmdArgs);
  
  // Check if this is a transfer command (either hardcoded or from mappings)
  const hardcodedTransferCommands = ['transfer', 'far', 'depn', 'disposal', 'gstr', 'gstt', 'payer', 'payet', 'ap', 'ar', 'fees', 'curr', 'ent', 'acct', 'gstrec', 'fa', 'xc', 'lc', 'gl'];
  const isHardcodedTransferCommand = hardcodedTransferCommands.includes(cmd.toLowerCase());
  
  // Check if command exists in transfer mappings
  let isMappedTransferCommand = false;
  try {
    const transferCommandMappings = await getConfig('transferCommandMappings');
    if (transferCommandMappings) {
      const mappingKey = Object.keys(transferCommandMappings)
        .find(key => key.toLowerCase() === cmd.toLowerCase());
      isMappedTransferCommand = !!mappingKey;
    }
  } catch (error) {
    console.error('[CommandHandler] Error checking transfer mappings:', error);
  }
  
  // Handle transfer commands (hardcoded or mapped)
  if (isHardcodedTransferCommand || isMappedTransferCommand) {
    
    // Parse arguments
    const options: { numFiles?: number; newName?: string; command?: string; currentDirectory?: string } = {};
    
    if (cmdArgs.length > 0) {
      const arg = cmdArgs[0];
      if (!isNaN(Number(arg))) {
        options.numFiles = Number(arg);
      } else {
        options.newName = arg;
      }
    }
    
    // Add command for template lookup
    options.command = cmd.toLowerCase();
    
    // Add current directory if provided
    if (currentDirectory) {
      options.currentDirectory = currentDirectory;
    }
    
    console.log('[CommandHandler] Transfer options:', options);
    
    // Execute transfer
    const result = await transferFiles(options);
    console.log('[CommandHandler] Transfer result:', result);
    return result;
  }
  
  // Handle finals command
  if (cmd.toLowerCase() === 'finals') {
    console.log('[CommandHandler] Executing finals command');
    
    const directory = currentDirectory || process.cwd();
    console.log('[CommandHandler] Finals directory:', directory);
    
    const result = await finalsCommand(directory, false); // false = not preview
    console.log('[CommandHandler] Finals command result:', result);
    
    return {
      success: result.success,
      message: result.message,
      files: result.files
    };
  }

  // Handle finals preview command
  if (cmd.toLowerCase() === 'finals_preview') {
    console.log('[CommandHandler] Executing finals preview command');
    
    const directory = currentDirectory || process.cwd();
    const result = await finalsCommand(directory, true); // true = preview
    
    return {
      success: result.success,
      message: result.message,
      files: result.files
    };
  }
  
  // Handle gst_rename command (called from button)
  if (cmd.toLowerCase() === 'gst_rename') {
    console.log('[CommandHandler] Executing GST rename command');
    const directory = currentDirectory || process.cwd();
    const result = await gstRenameCommand(directory);
    return {
      success: result.success,
      message: `${result.message}${result.processedFiles.length > 0 ? '\n\nProcessed files:\n' + result.processedFiles.join('\n') : ''}${result.errors.length > 0 ? '\n\nErrors:\n' + result.errors.join('\n') : ''}`,
      files: []
    };
  }
  
  // Handle gst_rename preview command
  if (cmd.toLowerCase() === 'gst_rename_preview') {
    console.log('[CommandHandler] Executing GST rename preview command');
    const directory = currentDirectory || process.cwd();
    const result = await gstRenameCommand(directory, true); // true = preview
    return {
      success: result.success,
      message: result.message,
      files: result.previewFiles || []
    };
  }
  
  // Handle merge_pdfs command
  if (cmd.toLowerCase() === 'merge_pdfs') {
    console.log('[CommandHandler] Executing merge PDFs command');
    const directory = currentDirectory || process.cwd();
    
    if (!options || !options.files || !options.outputFilename) {
      return {
        success: false,
        message: 'Merge PDFs requires files array and output filename'
      };
    }
    
    const result = await mergePdfs(directory, options);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle extract_zips command
  if (cmd.toLowerCase() === 'extract_zips') {
    console.log('[CommandHandler] Executing extract ZIPs command');
    const directory = currentDirectory || process.cwd();
    
    const result = await extractZips(directory);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle extract_eml command
  if (cmd.toLowerCase() === 'extract_eml') {
    console.log('[CommandHandler] Executing extract EML command');
    const directory = currentDirectory || process.cwd();
    
    const result = await extractEml(directory);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle extract_single_zip command
  if (cmd.toLowerCase() === 'extract_single_zip') {
    console.log('[CommandHandler] Executing single ZIP extraction command');
    const directory = currentDirectory || process.cwd();
    
    if (!options || !options.filename) {
      return {
        success: false,
        message: 'Single ZIP extraction requires filename'
      };
    }
    
    const result = await extractZips(directory, options.filename);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle extract_single_eml command
  if (cmd.toLowerCase() === 'extract_single_eml') {
    console.log('[CommandHandler] Executing single EML extraction command');
    const directory = currentDirectory || process.cwd();
    
    if (!options || !options.filename) {
      return {
        success: false,
        message: 'Single EML extraction requires filename'
      };
    }
    
    const result = await extractEml(directory, options.filename);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle gst_template command
  if (cmd.toLowerCase() === 'gst_template') {
    console.log('[CommandHandler] Executing GST template command');
    const directory = currentDirectory || process.cwd();
    
    const result = await gstTemplate(directory);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  // Handle update command
  if (cmd.toLowerCase() === 'update') {
    console.log('[CommandHandler] Executing update command');
    const directory = currentDirectory || process.cwd();
    
    const result = await updateApp(directory);
    return {
      success: result.success,
      message: result.message
    };
  }
  
  return {
    success: false,
    message: `Unknown command: ${cmd}`
  };
}