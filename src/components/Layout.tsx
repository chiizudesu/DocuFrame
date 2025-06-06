import React, { useState } from 'react';
import { Grid, GridItem, Box, Flex, useColorModeValue } from '@chakra-ui/react';
import { ClientInfoPane } from './ClientInfoPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { OutputLog } from './OutputLog';
import { ThemeToggle } from './ThemeToggle';
import { FileGrid } from './FileGrid';
import { Footer } from './Footer';
export const Layout: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [logHeight, setLogHeight] = useState(200);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');
  const mainBgColor = useColorModeValue('gray.50', 'gray.900');
  return <Grid templateAreas={`
        "ribbon ribbon ribbon"
        "sidebar header header"
        "sidebar main main"
        "sidebar footer footer"
        "status status status"
      `} gridTemplateRows={`auto auto 1fr ${logHeight}px auto`} gridTemplateColumns={`${sidebarWidth}px 1fr 1fr`} h="100%" gap="0" bg={mainBgColor}>
      {/* Function Ribbon */}
      <GridItem area="ribbon" borderBottom="1px" borderColor={borderColor} bg={bgColor}>
        <FunctionPanels />
      </GridItem>
      {/* Client Info Sidebar (formerly Folder Tree) */}
      <GridItem area="sidebar" borderRight="1px" borderColor={borderColor} bg={bgColor} overflowY="auto" display="flex" flexDirection="column">
        <Box flex="1" overflowY="auto">
          <ClientInfoPane />
        </Box>
      </GridItem>
      {/* Folder Info Bar */}
      <GridItem area="header" bg={bgColor} p={2} borderBottom="1px" borderColor={borderColor}>
        <FolderInfoBar />
      </GridItem>
      {/* Main Content Area */}
      <GridItem area="main" bg={mainBgColor} overflow="auto">
        <FileGrid />
      </GridItem>
      {/* Output Log */}
      <GridItem area="footer" bg={bgColor} borderTop="1px" borderColor={borderColor} position="relative">
        <OutputLog />
      </GridItem>
      {/* Status Footer */}
      <GridItem area="status" bg={bgColor} borderTop="1px" borderColor={borderColor}>
        <Footer />
      </GridItem>
    </Grid>;
};