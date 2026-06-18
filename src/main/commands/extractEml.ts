import * as fs from "fs";
import * as path from "path";
import { simpleParser, type ParsedMail } from "mailparser";

/** Strip characters Windows forbids in filenames. */
function sanitizeName(rawName: string): string {
  return rawName.replace(/[<>:"/\\|?*]/g, "_");
}

/** Resolve a non-colliding output path in `dir` for `safeName` (appends _1, _2, …). */
function uniqueOutputPath(dir: string, safeName: string): string {
  let outputPath = path.join(dir, safeName);
  let counter = 1;
  while (fs.existsSync(outputPath)) {
    const ext = path.extname(safeName);
    const name = path.basename(safeName, ext);
    outputPath = path.join(dir, `${name}_${counter}${ext}`);
    counter++;
  }
  return outputPath;
}

/** Write every attachment (incl. inline images) of a parsed email into `targetDirectory`. */
function writeAttachments(parsed: ParsedMail, targetDirectory: string, extractedFiles: string[]) {
  for (const att of parsed.attachments ?? []) {
    const rawName =
      att.filename ||
      (att.cid ? `inline_${att.cid}` : undefined) ||
      "attachment";
    const safeName = sanitizeName(rawName);
    const outputPath = uniqueOutputPath(targetDirectory, safeName);
    fs.writeFileSync(outputPath, att.content);
    extractedFiles.push(path.basename(outputPath));
  }
}

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
      writeAttachments(parsed, currentDirectory, extractedFiles);
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

/** A single email source to extract attachments from: either an on-disk path or raw base64 bytes. */
export interface EmlSource {
  /** Display name used for error messages (e.g. the dragged email's filename). */
  name?: string;
  /** Absolute path to a .eml on disk (used when the email came from Explorer). */
  path?: string;
  /** Base64-encoded .eml bytes (used when the email was dragged from Outlook as a virtual file). */
  dataBase64?: string;
}

/**
 * Extract attachments from a mix of email sources (on-disk paths and/or in-memory
 * base64 buffers) into `targetDirectory`. The source emails themselves are never written.
 */
export async function extractEmlSources(targetDirectory: string, sources: EmlSource[]) {
  const extractedFiles: string[] = [];
  const errors: string[] = [];

  for (const src of sources) {
    const label = src.name || src.path || "email";
    try {
      let buffer: Buffer;
      if (src.path) {
        if (!fs.existsSync(src.path)) throw new Error(`EML file not found: ${src.path}`);
        buffer = fs.readFileSync(src.path);
      } else if (src.dataBase64) {
        buffer = Buffer.from(src.dataBase64, "base64");
      } else {
        throw new Error("No path or data provided");
      }

      const parsed = await simpleParser(buffer);
      const before = extractedFiles.length;
      writeAttachments(parsed, targetDirectory, extractedFiles);
      if (extractedFiles.length === before) {
        errors.push(`${label}: no attachments found`);
      }
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const message =
    errors.length === 0
      ? `Extracted ${extractedFiles.length} attachment(s) from ${sources.length} email(s).`
      : `Extracted ${extractedFiles.length} attachment(s). Issues:\n${errors.join("\n")}`;

  return { success: errors.length > 0 ? extractedFiles.length > 0 : true, message, extractedFiles, errors };
}
