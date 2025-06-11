
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sun, Moon, Laptop } from 'lucide-react';

export const ThemeSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="neuro border-none">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the CRM looks and feels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Theme</h3>
            <p className="text-sm text-muted-foreground">
              Select a theme for the dashboard.
            </p>
          </div>
          
          <RadioGroup 
            value={theme} 
            onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem 
                value="light" 
                id="light" 
                className="peer sr-only" 
              />
              <Label 
                htmlFor="light" 
                className="neuro flex flex-col items-center justify-between rounded-md p-4 hover:bg-muted/50 cursor-pointer peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-pulse"
              >
                <Sun className="h-5 w-5 mb-3" />
                Light
              </Label>
            </div>
            
            <div>
              <RadioGroupItem 
                value="dark" 
                id="dark" 
                className="peer sr-only" 
              />
              <Label 
                htmlFor="dark" 
                className="neuro flex flex-col items-center justify-between rounded-md p-4 hover:bg-muted/50 cursor-pointer peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-pulse"
              >
                <Moon className="h-5 w-5 mb-3" />
                Dark
              </Label>
            </div>
            
            <div>
              <RadioGroupItem 
                value="system" 
                id="system" 
                className="peer sr-only" 
              />
              <Label 
                htmlFor="system" 
                className="neuro flex flex-col items-center justify-between rounded-md p-4 hover:bg-muted/50 cursor-pointer peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-pulse"
              >
                <Laptop className="h-5 w-5 mb-3" />
                System
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
