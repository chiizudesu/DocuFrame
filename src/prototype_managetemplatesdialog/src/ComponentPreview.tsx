import React, { useState, Component } from 'react';
import { Button, VStack } from '@chakra-ui/react';
import { TemplateManager } from './src/TemplateManager';
export function ComponentPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const samplePlaceholders = [{
    name: '{{revenue}}'
  }, {
    name: '{{revenue_change_direction}}'
  }, {
    name: '{{revenue_change_percent}}'
  }, {
    name: '{{revenue_reason}}'
  }];
  const sampleContent = `Company Annual Accounts
For the 12 months ending March 2025, revenue was {{revenue}} - 
this is an overall {{revenue_change_direction}} of 
{{revenue_change_percent}}% from the year ending March 2024.
This was largely due to {{revenue_reason}}.`;
  return <VStack h="100vh" justify="center" bg="gray.100" spacing={4}>
      <Button onClick={() => setIsOpen(true)}>Open Template Manager</Button>
      <TemplateManager isOpen={isOpen} onClose={() => setIsOpen(false)} templateName="2025 Annual Accounts Company" templateContent={sampleContent} placeholders={samplePlaceholders} onSave={() => console.log('Saving...')} />
    </VStack>;
}