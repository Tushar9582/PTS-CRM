
import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  className?: string;
  trend?: {
    value: number;
    positive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  className,
  trend
}) => {
  return (
    <div className={cn("neuro p-4 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold">{value}</div>
        
        {trend && (
          <div className={`text-xs flex items-center ${
            trend.positive ? 'text-green-500' : 'text-red-500'
          }`}>
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </div>
    </div>
  );
};
