/**
 * FileGrid orchestration: dialogs only. Extracted so subscription boundaries stay obvious.
 * See docs/filegrid-vs-file-manager-performance.md
 */
import React from 'react';
import { MergePDFDialog } from '../MergePDFDialog';
import { ExtractedTextDialog } from '../ExtractedTextDialog';
import { CustomPropertiesDialog } from '../CustomPropertiesDialog';
import { ImagePasteDialog } from '../ImagePasteDialog';
import { IndexPrefixDialog } from '../IndexPrefixDialog';
import { RenameIndexDialog } from '../RenameIndexDialog';
import { MoveToDialogWrapper } from './FileGridUI';
import { extractIndexPrefix } from '../../utils/indexPrefix';
import type { FileItem } from '../../types';
import type { FileProperties } from '../CustomPropertiesDialog';

export interface FileGridDialogsProps {
  currentDirectory: string;
  selectedFiles: string[];
  selectedFilesSet: Set<string>;
  sortedFiles: FileItem[];
  contextMenu: { fileItem: FileItem | null };
  addLog: (msg: string, type?: 'error' | 'response' | 'command' | 'info') => void;
  setStatus: (msg: string, type?: 'default' | 'error' | 'info' | 'success') => void;
  refreshDirectory: (path: string) => Promise<void>;
  setMergePDFOpen: (open: boolean) => void;
  setExtractedTextOpen: (open: boolean) => void;
  setPropertiesOpen: (open: boolean) => void;
  setImagePasteOpen: (open: boolean) => void;
  setIsMoveToDialogOpen: (open: boolean) => void;
  setMoveToFiles: (files: FileItem[]) => void;
  setIsIndexPrefixDialogOpen: (open: boolean) => void;
  setIsRenameIndexDialogOpen: (open: boolean) => void;
  isMergePDFOpen: boolean;
  isExtractedTextOpen: boolean;
  extractedTextData: { fileName: string; text: string };
  isPropertiesOpen: boolean;
  propertiesFile: FileProperties | null;
  isImagePasteOpen: boolean;
  isIndexPrefixDialogOpen: boolean;
  prefixDialogFiles: FileItem[];
  isMoveToDialogOpen: boolean;
  moveToFiles: FileItem[];
  isRenameIndexDialogOpen: boolean;
  closeIndexPrefixDialog: () => void;
  closeRenameIndexDialog: () => void;
  handleAssignPrefix: (indexKey: string | null, isCopy?: boolean) => Promise<void>;
  handleRenameIndex: (sourceIndex: string, targetIndex: string) => Promise<void>;
  handleUnblockFile: () => Promise<void>;
  handleImageSaved: (filename: string) => Promise<void>;
  showFileOperationFailure: (opts: {
    title: string;
    description: string;
    operationLabel: string;
    retry: () => Promise<boolean>;
    onCancel?: () => void;
  }) => void;
}

export const FileGridDialogs: React.FC<FileGridDialogsProps> = (props) => {
  const {
    currentDirectory,
    selectedFiles,
    selectedFilesSet,
    sortedFiles,
    contextMenu,
    addLog,
    setStatus,
    refreshDirectory,
    setMergePDFOpen,
    setExtractedTextOpen,
    setPropertiesOpen,
    setImagePasteOpen,
    setIsMoveToDialogOpen,
    setMoveToFiles,
    isMergePDFOpen,
    isExtractedTextOpen,
    extractedTextData,
    isPropertiesOpen,
    propertiesFile,
    isImagePasteOpen,
    isIndexPrefixDialogOpen,
    prefixDialogFiles,
    isMoveToDialogOpen,
    moveToFiles,
    isRenameIndexDialogOpen,
    closeIndexPrefixDialog,
    closeRenameIndexDialog,
    handleAssignPrefix,
    handleRenameIndex,
    handleUnblockFile,
    handleImageSaved,
    showFileOperationFailure,
  } = props;

  return (
    <>
      {isMergePDFOpen && (
        <MergePDFDialog
          isOpen
          onClose={() => setMergePDFOpen(false)}
          currentDirectory={currentDirectory}
          preselectedFiles={selectedFiles.filter((filename) => filename.toLowerCase().endsWith('.pdf'))}
        />
      )}
      {isExtractedTextOpen && (
        <ExtractedTextDialog
          isOpen
          onClose={() => setExtractedTextOpen(false)}
          fileName={extractedTextData.fileName}
          extractedText={extractedTextData.text}
        />
      )}
      {isPropertiesOpen && propertiesFile && (
        <CustomPropertiesDialog
          isOpen
          onClose={() => setPropertiesOpen(false)}
          file={propertiesFile}
          onUnblock={handleUnblockFile}
        />
      )}
      {isImagePasteOpen && (
        <ImagePasteDialog
          isOpen
          onClose={() => setImagePasteOpen(false)}
          currentDirectory={currentDirectory}
          onImageSaved={handleImageSaved}
        />
      )}
      {isIndexPrefixDialogOpen && (
        <IndexPrefixDialog
          isOpen
          onClose={closeIndexPrefixDialog}
          onSelect={handleAssignPrefix}
          currentPrefix={prefixDialogFiles.length > 0 ? extractIndexPrefix(prefixDialogFiles[0].name) : null}
          files={prefixDialogFiles}
          title="Manage Index Prefix"
          allowCopy={true}
        />
      )}
      {isMoveToDialogOpen && moveToFiles.length > 0 && (
        <MoveToDialogWrapper
          onClose={() => {
            setIsMoveToDialogOpen(false);
            setMoveToFiles([]);
          }}
          moveToFiles={moveToFiles}
          currentDirectory={currentDirectory}
          onSelectFolder={async (destPath: string) => {
            const runMove = (paths: string[]) =>
              window.electronAPI.moveFilesWithConflictResolution(paths, destPath);
            try {
              setStatus(`Moving ${moveToFiles.length} file(s)...`, 'info');
              const results = await runMove(moveToFiles.map((f) => f.path));
              const successful = results.filter((r) => r.status === 'success');
              const failedResults = results.filter((r) => r.status === 'error');

              if (successful.length > 0) {
                setStatus(`Moved ${successful.length} file(s)`, 'success');
                await refreshDirectory(currentDirectory);
              }

              if (failedResults.length > 0) {
                const lines = failedResults.map((r) => {
                  const base = r.file.split(/[/\\]/).pop() ?? r.file;
                  return `• ${base}: ${r.error ?? r.reason ?? 'Unknown error'}`;
                });
                addLog(`Move failed for ${failedResults.length} item(s):\n${lines.join('\n')}`, 'error');
                setStatus(
                  failedResults.length === moveToFiles.length
                    ? 'Failed to move files'
                    : `Some files failed to move (${failedResults.length})`,
                  'error'
                );
                showFileOperationFailure({
                  title: 'Move Failed',
                  description: lines.join('\n'),
                  operationLabel: 'Move',
                  retry: async () => {
                    const pathsToRetry = failedResults
                      .map((r) => moveToFiles.find((f) => f.name === r.file)?.path)
                      .filter((p): p is string => Boolean(p));
                    if (pathsToRetry.length === 0) return false;
                    const results2 = await runMove(pathsToRetry);
                    const failed2 = results2.filter((r) => r.status === 'error');
                    if (results2.some((r) => r.status === 'success')) {
                      await refreshDirectory(currentDirectory);
                    }
                    if (failed2.length === 0) {
                      setIsMoveToDialogOpen(false);
                      setMoveToFiles([]);
                    }
                    return failed2.length === 0;
                  },
                });
              }

              if (failedResults.length === 0) {
                setIsMoveToDialogOpen(false);
                setMoveToFiles([]);
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              addLog(`Failed to move files: ${msg}`, 'error');
              setStatus('Failed to move files', 'error');
              showFileOperationFailure({
                title: 'Move Failed',
                description: msg,
                operationLabel: 'Move',
                retry: async () => {
                  try {
                    const results = await runMove(moveToFiles.map((f) => f.path));
                    const failed = results.filter((r) => r.status === 'error');
                    if (results.some((r) => r.status === 'success')) {
                      await refreshDirectory(currentDirectory);
                    }
                    if (failed.length === 0) {
                      setIsMoveToDialogOpen(false);
                      setMoveToFiles([]);
                    }
                    return failed.length === 0;
                  } catch {
                    return false;
                  }
                },
              });
            }
          }}
          refreshDirectory={refreshDirectory}
          setStatus={setStatus}
          addLog={(msg, type) =>
            addLog(msg, (type as 'success' | undefined) === 'success' ? 'info' : type)
          }
        />
      )}
      {isRenameIndexDialogOpen && (
        <RenameIndexDialog
          isOpen
          onClose={closeRenameIndexDialog}
          onConfirm={handleRenameIndex}
          files={
            selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
              ? sortedFiles.filter((f) => selectedFilesSet.has(f.name) && f.type === 'file')
              : contextMenu.fileItem && contextMenu.fileItem.type === 'file'
                ? [contextMenu.fileItem]
                : []
          }
        />
      )}
    </>
  );
};
