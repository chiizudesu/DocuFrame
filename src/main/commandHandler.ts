import { transferFiles } from './commands/transfer';
import { getConfig } from './config';

interface CommandResult {
  success: boolean;
  message: string;
}

export async function handleCommand(command: string, args: string[]): Promise<CommandResult> {
  // Get command name and arguments
  const [cmd, ...cmdArgs] = command.split(' ');
  
  // Handle transfer commands
  if (cmd === 'transfer' || cmd === 'far' || cmd === 'depn' || cmd === 'disposal' || 
      cmd === 'gstr' || cmd === 'gstt' || cmd === 'payer' || cmd === 'payet' || 
      cmd === 'ap' || cmd === 'ar' || cmd === 'fees' || cmd === 'curr' || 
      cmd === 'ent' || cmd === 'acct' || cmd === 'gstrec' || cmd === 'fa' || 
      cmd === 'xc' || cmd === 'lc' || cmd === 'gl') {
    
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
    options.command = cmd;
    
    // Execute transfer
    return await transferFiles(options);
  }
  
  // Handle other commands here...
  
  return {
    success: false,
    message: `Unknown command: ${cmd}`
  };
} 