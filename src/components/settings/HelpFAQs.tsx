import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { HelpCircle, FileText, MessageSquare, Video, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export const HelpFAQs: React.FC = () => {
  const isMobile = useIsMobile();

  const faqs = [
    {
      question: "How do I add a new lead?",
      answer: "To add a new lead, navigate to the Leads page and click on the 'Add Lead' button in the top right corner. Fill in the required information in the form and click 'Save'."
    },
    {
      question: "How do I assign a lead to an agent?",
      answer: "You can assign leads to an agent by navigating to the 'Assign Lead' section. There, you can specify a lead range — from a specific start ID to an end ID — and assign that entire range to a selected agent."
    },
    {
      question: "How do I track client progress?",
      answer: "You can track client progress on the client page. Each client card shows the current status and progress. Click on a client to view detailed information and update its status."
    },
    {
      question: "How do I schedule a meeting with a lead?",
      answer: "Navigate to the Meetings page and click 'Schedule Meeting'. Select the lead, date, time, and other relevant details in the form. Once saved, the meeting will appear in your calendar."
    },
    // {
    //   question: "How do I customize my notification preferences?",
    //   answer: "Go to Settings > Notifications to customize which notifications you receive and how you receive them. You can choose between email, in-app, and SMS notifications for different events."
    // },
    {
      question: "How do I export lead data?",
      answer: "On the Leads page, click on the 'Export' button to download your lead data as a CSV or Excel file. You can filter the data before exporting to include only specific leads."
    },
  ];

  const resources = [
    { title: "User Manual", icon: <FileText className="h-5 w-5" />, action: "Download" },
    { title: "Video Tutorials", icon: <Video className="h-5 w-5" />, action: "View" },
    { title: "Contact Support", icon: <MessageSquare className="h-5 w-5" />, action: "Chat" },
  ];

  return (
    <Card className="neuro border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Help & FAQs
        </CardTitle>
        <CardDescription>
          Find answers to commonly asked questions and access helpful resources.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-purple-500" />
            Frequently Asked Questions
          </h3>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="neuro border-none rounded-md my-2">
                <AccordionTrigger className="text-left px-4 hover:no-underline font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-medium">Helpful Resources</h3>



          <div className="mt-8 p-4 neuro-inset rounded-lg">
            <h4 className="font-medium mb-2 flex items-center">
              <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
              Still need help?
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is available 24/7 to assist you with any questions you may have.
            </p>
            <div className="flex justify-center">
              <Button
                className="neuro hover:shadow-none transition-all duration-300"
                onClick={() => window.location.href = "https://www.pawartechnologyservices.com/"}
              >
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};