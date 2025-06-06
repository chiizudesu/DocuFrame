import { transferFiles } from './commands/transfer';
import { getConfig } from './config';

interface CommandResult {
  success: boolean;
  message: string;
  files?: any[];
}

export async function handleCommand(command: string, args: string[]): Promise<CommandResult> {
  console.log('Handling command:', command, 'with args:', args);
  
  // Get command name and arguments
  const [cmd, ...cmdArgs] = command.split(' ');
  console.log('Parsed command:', cmd, 'with args:', cmdArgs);
  
  // Handle transfer commands
  if (cmd.toLowerCase() === 'transfer' || cmd.toLowerCase() === 'far' || cmd.toLowerCase() === 'depn' || cmd.toLowerCase() === 'disposal' || 
      cmd.toLowerCase() === 'gstr' || cmd.toLowerCase() === 'gstt' || cmd.toLowerCase() === 'payer' || cmd.toLowerCase() === 'payet' || 
      cmd.toLowerCase() === 'ap' || cmd.toLowerCase() === 'ar' || cmd.toLowerCase() === 'fees' || cmd.toLowerCase() === 'curr' || 
      cmd.toLowerCase() === 'ent' || cmd.toLowerCase() === 'acct' || cmd.toLowerCase() === 'gstrec' || cmd.toLowerCase() === 'fa' || 
      cmd.toLowerCase() === 'xc' || cmd.toLowerCase() === 'lc' || cmd.toLowerCase() === 'gl') {
    
    // Parse arguments
    const options: { numFiles?: number; newName?: string; command?: string } = {};
    
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
    
    console.log('Transfer options:', options);
    
    // Execute transfer
    const result = await transferFiles(options);
    console.log('Transfer result:', result);
    return result;
  }
  
  // Handle other commands here...
  
  return {
    success: false,
    message: `Unknown command: ${cmd}`
  };
} 