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
import { SmartRenameDialog } from '../SmartRenameDialog';
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
  setIsSmartRenameDialogOpen: (open: boolean) => void;
  setSmartRenameFile: (f: FileItem | null) => void;
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
  smartRenameFile: FileItem | null;
  isSmartRenameDialogOpen: boolean;
  closeIndexPrefixDialog: () => void;
  closeRenameIndexDialog: () => void;
  handleAssignPrefix: (indexKey: string | null, isCopy?: boolean) => Promise<void>;
  handleRenameIndex: (sourceIndex: string, targetIndex: string) => Promise<void>;
  handleSmartRenameConfirm: (newName: string) => Promise<void>;
  handleUnblockFile: () => Promise<void>;
  handleImageSaved: (filename: string) => Promise<void>;
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
    smartRenameFile,
    isSmartRenameDialogOpen,
    setIsSmartRenameDialogOpen,
    setSmartRenameFile,
    closeIndexPrefixDialog,
    closeRenameIndexDialog,
    handleAssignPrefix,
    handleRenameIndex,
    handleSmartRenameConfirm,
    handleUnblockFile,
    handleImageSaved,
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
            try {
              setStatus(`Moving ${moveToFiles.length} file(s)...`, 'info');
              const results = await window.electronAPI.moveFilesWithConflictResolution(
                moveToFiles.map((f) => f.path),
                destPath
              );
              const successful = results.filter((r) => r.status === 'success').length;
              if (successful > 0) {
                setStatus(`Moved ${successful} file(s)`, 'success');
                await refreshDirectory(currentDirectory);
              }
              setIsMoveToDialogOpen(false);
              setMoveToFiles([]);
            } catch (error) {
              addLog(`Failed to move files: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('Failed to move files', 'error');
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
      {smartRenameFile && (
        <SmartRenameDialog
          isOpen={isSmartRenameDialogOpen}
          onClose={() => {
            setIsSmartRenameDialogOpen(false);
            setSmartRenameFile(null);
          }}
          onConfirm={handleSmartRenameConfirm}
          file={smartRenameFile}
          existingFiles={sortedFiles}
        />
      )}
    </>
  );
};
