
import React, { useState } from 'react';
import { format, startOfToday, eachDayOfInterval, endOfMonth, startOfMonth, isToday, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mockMeetings } from '@/lib/mockData';

export const Calendar: React.FC = () => {
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(today);
  
  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Get meetings for the day
  const getMeetingsForDate = (date: Date) => {
    return mockMeetings.filter(meeting => meeting.startDate === format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="neuro p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div className="flex space-x-1">
          <Button 
            onClick={previousMonth}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
          >
            <ChevronLeft size={16} />
          </Button>
          <div className="text-sm font-medium">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <Button 
            onClick={nextMonth}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-center mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const meetings = getMeetingsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          
          return (
            <div
              key={day.toString()}
              className={cn(
                "aspect-square p-1 relative",
                !isCurrentMonth && "opacity-30",
              )}
            >
              <div
                className={cn(
                  "h-full w-full flex flex-col items-center justify-start p-1 text-xs rounded-md",
                  isToday(day) && "bg-pulse/10 font-bold",
                  meetings.length > 0 && "ring-1 ring-pulse"
                )}
              >
                <span className="mb-1">{format(day, 'd')}</span>
                {meetings.length > 0 && (
                  <div className="w-full mt-auto">
                    <div className="bg-pulse text-white text-[10px] rounded px-1 py-0.5 truncate">
                      {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
