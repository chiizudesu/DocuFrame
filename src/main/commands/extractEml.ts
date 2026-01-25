import * as fs from "fs";
import * as path from "path";
import { simpleParser } from "mailparser";

export async function extractEml(currentDirectory: string, singleFile?: string) {
  const emlFiles = singleFile
    ? [singleFile]
    : fs.readdirSync(currentDirectory).filter(f => f.toLowerCase().endsWith(".eml"));

  if (emlFiles.length === 0) {
    return { success: false, message: "No EML files found in current directory", extractedFiles: [] as string[] };
  }

  const extractedFiles: string[] = [];
  const errors: string[] = [];

  for (const emlFile of emlFiles) {
    try {
      const emlPath = path.isAbsolute(emlFile) ? emlFile : path.join(currentDirectory, emlFile);
      if (!fs.existsSync(emlPath)) throw new Error(`EML file not found: ${emlFile}`);

      const parsed = await simpleParser(fs.createReadStream(emlPath));

      // Includes attachments + inline images (signatures) reliably
      for (const att of parsed.attachments ?? []) {
        const rawName =
          att.filename ||
          (att.cid ? `inline_${att.cid}` : undefined) ||
          "attachment";

        const safeName = rawName.replace(/[<>:"/\\|?*]/g, "_");

        let outputPath = path.join(currentDirectory, safeName);
        let counter = 1;
        while (fs.existsSync(outputPath)) {
          const ext = path.extname(safeName);
          const name = path.basename(safeName, ext);
          outputPath = path.join(currentDirectory, `${name}_${counter}${ext}`);
          counter++;
        }

        fs.writeFileSync(outputPath, att.content);
        extractedFiles.push(path.basename(outputPath));
      }
    } catch (e) {
      errors.push(`${emlFile}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const message =
    errors.length === 0
      ? `Processed ${emlFiles.length} EML file(s). Extracted ${extractedFiles.length} file(s).`
      : `Processed ${emlFiles.length} EML file(s). Extracted ${extractedFiles.length} file(s).\n\nErrors:\n${errors.join("\n")}`;

  return { success: errors.length === 0, message, extractedFiles };
}
