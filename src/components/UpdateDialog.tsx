import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Progress,
  useColorModeValue,
  Icon,
  Divider,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner
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
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
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
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        boxShadow="xl"
        mx={4}
      >
        <ModalHeader
          borderBottom="1px solid"
          borderColor={borderColor}
          pb={4}
          display="flex"
          alignItems="center"
          gap={3}
        >
          <Icon as={Download} boxSize={6} color={accentColor} />
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            Software Updates
          </Text>
        </ModalHeader>

        <ModalBody py={6}>
          <VStack spacing={6} align="stretch">
            {/* Current Version Info */}
            <Box
              p={4}
              bg={useColorModeValue('gray.50', 'gray.700')}
              borderRadius="lg"
              border="1px solid"
              borderColor={borderColor}
            >
              <HStack justify="space-between" align="center">
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" color={secondaryTextColor} fontWeight="medium">
                    Current Version
                  </Text>
                  <HStack spacing={2}>
                    <Text fontSize="lg" fontWeight="bold" color={textColor}>
                      {updateInfo.currentVersion}
                    </Text>
                    <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                      INSTALLED
                    </Badge>
                  </HStack>
                </VStack>
                <Icon as={CheckCircle} boxSize={5} color={successColor} />
              </HStack>
            </Box>

            {/* Status Area - Always Visible */}
            <Box minH="80px">
              {/* Checking for Updates */}
              {isChecking && (
                <Alert status="info" borderRadius="lg">
                  <Box mr={3}>
                    <Spinner size="sm" color="blue.500" />
                  </Box>
                  <Box>
                    <AlertTitle fontSize="sm">Checking for Updates</AlertTitle>
                    <AlertDescription fontSize="xs">
                      Please wait while we check for the latest version...
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Error State */}
              {!isChecking && updateInfo.error && (
                <Alert status="error" borderRadius="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">Update Error</AlertTitle>
                    <AlertDescription fontSize="xs">
                      {updateInfo.error}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Update Available */}
              {!isChecking && !updateInfo.error && hasUpdate && (
                <Alert status="success" borderRadius="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">Update Available</AlertTitle>
                    <AlertDescription fontSize="xs">
                      Version {updateInfo.availableVersion} is now available for download.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* No Updates Available */}
              {!isChecking && !updateInfo.error && !hasUpdate && (
                <Alert status="info" borderRadius="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">No Updates Available</AlertTitle>
                    <AlertDescription fontSize="xs">
                      You're running the latest version of DocuFrame.
                    </AlertDescription>
                  </Box>
                </Alert>
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
                  <VStack align="start" spacing={1}>
                    <Text fontSize="sm" color={secondaryTextColor} fontWeight="medium">
                      Available Version
                    </Text>
                    <HStack spacing={2}>
                      <Text fontSize="lg" fontWeight="bold" color={textColor}>
                        {updateInfo.availableVersion}
                      </Text>
                      <Badge colorScheme="green" variant="subtle" fontSize="xs">
                        NEW
                      </Badge>
                    </HStack>
                    {updateInfo.downloadSize && (
                      <Text fontSize="xs" color={secondaryTextColor}>
                        Size: {updateInfo.downloadSize}
                      </Text>
                    )}
                  </VStack>
                  <Icon as={Download} boxSize={5} color={accentColor} />
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
                <Progress
                  value={updateInfo.downloadProgress}
                  colorScheme="blue"
                  borderRadius="full"
                  size="sm"
                />
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
        </ModalBody>

        <ModalFooter
          borderTop="1px solid"
          borderColor={borderColor}
          pt={4}
          gap={3}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            leftIcon={<Icon as={X} boxSize={4} />}
            color={secondaryTextColor}
            _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
          >
            Close
          </Button>

          <Button
            variant="outline"
            onClick={handleCheckForUpdates}
            leftIcon={<Icon as={RefreshCw} boxSize={4} />}
            isLoading={isChecking}
            loadingText="Checking..."
            color={accentColor}
            borderColor={accentColor}
            _hover={{ bg: useColorModeValue('blue.50', 'blue.900') }}
          >
            Check for Updates
          </Button>

          {hasUpdate && !updateInfo.isDownloaded && (
            <Button
              colorScheme="blue"
              onClick={handleDownloadUpdate}
              leftIcon={<Icon as={Download} boxSize={4} />}
              isLoading={isDownloading}
              loadingText="Downloading..."
            >
              Download Update
            </Button>
          )}

          {updateInfo.isDownloaded && (
            <Button
              colorScheme="green"
              onClick={handleInstallUpdate}
              leftIcon={<Icon as={CheckCircle} boxSize={4} />}
              isLoading={isInstalling}
              loadingText="Installing..."
            >
              Install & Restart
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 