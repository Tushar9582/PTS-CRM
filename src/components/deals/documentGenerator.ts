interface Deal {
  // Your deal interface
}

interface DocumentTemplate {
  id: string;
  name: string;
  content: string;
}

export const getTemplates = async (): Promise<DocumentTemplate[]> => {
  // In a real app, this would fetch from your backend
  return [
    {
      id: 'contract',
      name: 'Standard Contract',
      content: 'This agreement is made between {{company}} and...'
    },
    {
      id: 'proposal',
      name: 'Sales Proposal',
      content: 'We propose to provide services to {{company}} for ${{amount}}...'
    }
  ];
};

export const generateDocument = async (templateId: string, deal: Deal): Promise<string> => {
  // In a real app, this would use a proper templating engine
  const templates = await getTemplates();
  const template = templates.find(t => t.id === templateId);
  
  if (!template) throw new Error('Template not found');
  
  // Simple template replacement
  let content = template.content;
  for (const [key, value] of Object.entries(deal)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  
  return content;
};