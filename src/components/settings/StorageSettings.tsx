import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, HardDrive, Upload, File, Archive } from 'lucide-react';
import { FileManager } from '@/components/common/FileManager';
import { toast } from 'sonner';

export const StorageSettings: React.FC = () => {
  const [showFileManager, setShowFileManager] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  
  // Storage data in bytes
  const storage = {
    used: 500 * 1024 * 1024, // 500MB in bytes (example)
    total: 5 * 1024 * 1024 * 1024, // 5GB in bytes (example)
    byType: {
      document: 200 * 1024 * 1024, // 200MB
      archive: 150 * 1024 * 1024, // 150MB
      database: 150 * 1024 * 1024, // 150MB
    }
  };

  // Calculate actual percentage
  const actualPercentage = Math.min(100, (storage.used / storage.total) * 100);

  // Animate progress bar
  useEffect(() => {
    const duration = 1000; // Animation duration in ms
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      setAnimatedProgress(progress * actualPercentage);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
    
    // Scroll progress bar into view if it's not visible
    if (progressRef.current) {
      progressRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [actualPercentage]);

  // Format storage with GB/MB display
  const formatStorage = (bytes: number): string => {
    const gbValue = bytes / (1024 * 1024 * 1024);
    const mbValue = bytes / (1024 * 1024);
    
    if (gbValue >= 1) {
      return `${gbValue.toFixed(1)} GB (${mbValue.toFixed(0)} MB)`;
    }
    return `${mbValue.toFixed(1)} MB`;
  };

  const storageCategories = [
    { name: 'Documents', icon: <File className="h-5 w-5 text-blue-500" />, size: storage.byType.document },
    { name: 'Archives', icon: <Archive className="h-5 w-5 text-yellow-500" />, size: storage.byType.archive },
    { name: 'Database', icon: <Database className="h-5 w-5 text-cyan-500" />, size: storage.byType.database },
  ];

  const handleUpload = () => setShowFileManager(true);

  const handleFileManagerClose = (files?: File[]) => {
    setShowFileManager(false);
    if (files && files.length > 0) {
      toast.success(`${files.length} file(s) uploaded`);
    }
  };

  return (
    <>
      <Card className="border-none">
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            Total storage: {formatStorage(storage.total)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4" ref={progressRef}>
            <HardDrive className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Used: {formatStorage(storage.used)}</span>
                <span>{actualPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={animatedProgress} className="h-2 w-full transition-all duration-1000" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {storageCategories.map((category) => (
              <div key={category.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {category.icon}
                <div>
                  <p className="text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatStorage(category.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </CardFooter>
      </Card>

      <FileManager
        isOpen={showFileManager}
        onClose={handleFileManagerClose}
        mode="import"
      />
    </>
  );
};