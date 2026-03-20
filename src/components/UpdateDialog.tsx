import React, { useState, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Progress,
  Icon,
  Badge,
  Alert,
  Spinner,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Download, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';

interface UpdateInfo {
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  downloadSize?: string;
  isDownloading?: boolean;
  downloadProgress?: number;
  isDownloaded?: boolean;
  error?: string;
}

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckForUpdates: () => Promise<void>;
  onDownloadUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  updateInfo: UpdateInfo;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen,
  onClose,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  updateInfo
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Theme colors
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
  const accentColor = useColorModeValue('blue.500', 'blue.400');
  const successColor = useColorModeValue('green.500', 'green.400');
  const errorColor = useColorModeValue('red.500', 'red.400');

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      await onCheckForUpdates();
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    setIsDownloading(true);
    try {
      await onDownloadUpdate();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    setIsInstalling(true);
    try {
      await onInstallUpdate();
    } finally {
      setIsInstalling(false);
    }
  };

  const hasUpdate = updateInfo.availableVersion && updateInfo.availableVersion !== updateInfo.currentVersion;
  const isNewer = hasUpdate && updateInfo.availableVersion! > updateInfo.currentVersion;

  return (
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="xl"
            boxShadow="xl"
            mx={4}>
            <Dialog.Header
              borderBottom="1px solid"
              borderColor={borderColor}
              pb={4}
              display="flex"
              alignItems="center"
              gap={3}
            >
              <Icon boxSize={6} color={accentColor} asChild><Download /></Icon>
              <Text fontSize="lg" fontWeight="semibold" color={textColor}>
                Software Updates
              </Text>
            </Dialog.Header>
            <Dialog.Body py={6}>
              <VStack gap={6} align="stretch">
                {/* Current Version Info */}
                <Box
                  p={4}
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                >
                  <HStack justify="space-between" align="center">
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" color={secondaryTextColor} fontWeight="medium">
                        Current Version
                      </Text>
                      <HStack gap={2}>
                        <Text fontSize="lg" fontWeight="bold" color={textColor}>
                          {updateInfo.currentVersion}
                        </Text>
                        <Badge colorPalette="blue" variant="subtle" fontSize="xs">
                          INSTALLED
                        </Badge>
                      </HStack>
                    </VStack>
                    <Icon boxSize={5} color={successColor} asChild><CheckCircle /></Icon>
                  </HStack>
                </Box>

                {/* Status Area - Always Visible */}
                <Box minH="80px">
                  {/* Checking for Updates */}
                  {isChecking && (
                    <Alert.Root status="info" borderRadius="lg">
                      <Box mr={3}>
                        <Spinner size="sm" color="blue.500" />
                      </Box>
                      <Box>
                        <Alert.Title fontSize="sm">Checking for Updates</Alert.Title>
                        <Alert.Description fontSize="xs">
                          Please wait while we check for the latest version...
                        </Alert.Description>
                      </Box>
                    </Alert.Root>
                  )}

                  {/* Error State */}
                  {!isChecking && updateInfo.error && (
                    <Alert.Root status="error" borderRadius="lg">
                      <Alert.Indicator />
                      <Box>
                        <Alert.Title fontSize="sm">Update Error</Alert.Title>
                        <Alert.Description fontSize="xs">
                          {updateInfo.error}
                        </Alert.Description>
                      </Box>
                    </Alert.Root>
                  )}

                  {/* Update Available */}
                  {!isChecking && !updateInfo.error && hasUpdate && (
                    <Alert.Root status="success" borderRadius="lg">
                      <Alert.Indicator />
                      <Box>
                        <Alert.Title fontSize="sm">Update Available</Alert.Title>
                        <Alert.Description fontSize="xs">
                          Version {updateInfo.availableVersion} is now available for download.
                        </Alert.Description>
                      </Box>
                    </Alert.Root>
                  )}

                  {/* No Updates Available */}
                  {!isChecking && !updateInfo.error && !hasUpdate && (
                    <Alert.Root status="info" borderRadius="lg">
                      <Alert.Indicator />
                      <Box>
                        <Alert.Title fontSize="sm">No Updates Available</Alert.Title>
                        <Alert.Description fontSize="xs">
                          You're running the latest version of DocuFrame.
                        </Alert.Description>
                      </Box>
                    </Alert.Root>
                  )}
                </Box>

                {/* Available Version Info */}
                {hasUpdate && (
                  <Box
                    p={4}
                    bg={useColorModeValue('blue.50', 'blue.900')}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor={useColorModeValue('blue.200', 'blue.600')}
                  >
                    <HStack justify="space-between" align="center">
                      <VStack align="start" gap={1}>
                        <Text fontSize="sm" color={secondaryTextColor} fontWeight="medium">
                          Available Version
                        </Text>
                        <HStack gap={2}>
                          <Text fontSize="lg" fontWeight="bold" color={textColor}>
                            {updateInfo.availableVersion}
                          </Text>
                          <Badge colorPalette="green" variant="subtle" fontSize="xs">
                            NEW
                          </Badge>
                        </HStack>
                        {updateInfo.downloadSize && (
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Size: {updateInfo.downloadSize}
                          </Text>
                        )}
                      </VStack>
                      <Icon boxSize={5} color={accentColor} asChild><Download /></Icon>
                    </HStack>
                  </Box>
                )}

                {/* Download Progress */}
                {updateInfo.isDownloading && updateInfo.downloadProgress !== undefined && (
                  <Box>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color={secondaryTextColor}>
                        Downloading Update
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" color={textColor}>
                        {Math.round(updateInfo.downloadProgress)}%
                      </Text>
                    </HStack>
                    <Progress.Root
                      value={updateInfo.downloadProgress}
                      colorPalette="blue"
                      borderRadius="full"
                      size="sm">
                      <Progress.Track>
                        <Progress.Range />
                      </Progress.Track>
                    </Progress.Root>
                  </Box>
                )}

                {/* Release Notes */}
                {hasUpdate && updateInfo.releaseNotes && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color={textColor} mb={2}>
                      What's New
                    </Text>
                    <Box
                      p={3}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="md"
                      border="1px solid"
                      borderColor={borderColor}
                      maxH="120px"
                      overflowY="auto"
                    >
                      <Text fontSize="xs" color={secondaryTextColor} whiteSpace="pre-wrap">
                        {updateInfo.releaseNotes}
                      </Text>
                    </Box>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer
              borderTop="1px solid"
              borderColor={borderColor}
              pt={4}
              gap={3}
            >
              <Button
                variant="ghost"
                onClick={onClose}
                color={secondaryTextColor}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}><Icon boxSize={4} asChild><X /></Icon>Close
                          </Button>

              <Button
                variant="outline"
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                color={accentColor}
                borderColor={accentColor}
                _hover={{ bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={4} asChild><RefreshCw /></Icon>Check for Updates
                          </Button>

              {hasUpdate && !updateInfo.isDownloaded && (
                <Button
                  colorPalette="blue"
                  onClick={handleDownloadUpdate}
                  disabled={isDownloading}><Icon boxSize={4} asChild><Download /></Icon>Download Update
                              </Button>
              )}

              {updateInfo.isDownloaded && (
                <Button
                  colorPalette="green"
                  onClick={handleInstallUpdate}
                  disabled={isInstalling}><Icon boxSize={4} asChild><CheckCircle /></Icon>Install & Restart
                              </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 