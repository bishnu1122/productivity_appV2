"use client";

import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Timer, Play, Pause, RotateCcw, Maximize2, Minimize2, History } from 'lucide-react';
import { format } from 'date-fns';

interface PomodoroSession {
  id: number;
  task_description: string;
  duration: number;
  completed_at: string;
}

interface CurrentTask {
  id: number;
  description: string;
  duration: number;
}

export default function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState(25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const { userName } = useUserStore();
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const lastTickRef = useRef<number>(Date.now());
  const sessionSavedRef = useRef(false);

  useEffect(() => {
    const checkForTask = () => {
      const savedTask = localStorage.getItem('currentTask');
      if (savedTask) {
        const task = JSON.parse(savedTask);
        setCurrentTask(task);
        setDuration(task.duration);
        setTimeLeft(task.duration * 60);
        setIsRunning(true);
        localStorage.removeItem('currentTask');
      }
    };

    checkForTask();
    fetchSessions();

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Use visibility change event to maintain accurate timer
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Save the last tick time when tab becomes hidden
        lastTickRef.current = Date.now();
      } else {
        // Calculate missed time when tab becomes visible
        if (isRunning && timeLeft > 0) {
          const now = Date.now();
          const missedTime = Math.floor((now - lastTickRef.current) / 1000);
          setTimeLeft(prev => Math.max(0, prev - missedTime));
          lastTickRef.current = now;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, timeLeft]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_name', userName)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      toast.error('Failed to fetch sessions');
    }
  };

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (isRunning && timeLeft > 0) {
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTickRef.current) / 1000);
        lastTickRef.current = now;

        setTimeLeft(prev => {
          const newTime = Math.max(0, prev - elapsed);
          if (newTime === 0 && !sessionSavedRef.current) {
            handleSessionComplete();
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const handleSessionComplete = async () => {
    if (sessionSavedRef.current) return;
    sessionSavedRef.current = true;
    setIsRunning(false);
    toast.success('Pomodoro session completed!');
    
    try {
      const { error } = await supabase.from('pomodoro_sessions').insert([
        {
          user_name: userName,
          task_id: currentTask?.id,
          task_description: currentTask?.description,
          duration: duration * 60,
          completed_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      
      if (currentTask?.id) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ completed: true })
          .eq('id', currentTask.id);

        if (!taskError) {
          toast.success('Task marked as completed!');
          setCurrentTask(null);
        }
      }
      
      fetchSessions();
    } catch (error) {
      toast.error('Failed to save session');
    }
  };

  const toggleTimer = () => {
    if (!isRunning && timeLeft === 0) {
      if (currentTask) {
        setTimeLeft(currentTask.duration * 60);
      } else {
        setTimeLeft(duration * 60);
      }
      sessionSavedRef.current = false;
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    sessionSavedRef.current = false;
    if (currentTask) {
      setTimeLeft(currentTask.duration * 60);
    } else {
      setTimeLeft(duration * 60);
    }
  };

  const handleDurationChange = (value: number[]) => {
    if (!currentTask) {
      const newDuration = value[0];
      setDuration(newDuration);
      setTimeLeft(newDuration * 60);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className={`transition-all duration-300 ${isFullscreen ? 'fixed inset-0 bg-background flex items-center justify-center z-50' : ''}`}>
        <Card className={`${isFullscreen ? 'w-full h-full flex items-center justify-center' : 'w-full'}`}>
          <CardContent className={`p-6 space-y-6 ${isFullscreen ? 'text-center' : ''}`}>
            {currentTask && (
              <div className="text-center text-muted-foreground mb-4">
                Current Task: {currentTask.description}
              </div>
            )}
            <div className="text-center">
              <div className={`font-bold mb-4 font-mono ${isFullscreen ? 'text-9xl' : 'text-6xl'}`}>
                {formatTime(timeLeft)}
              </div>
              <div className="space-x-2">
                <Button onClick={toggleTimer}>
                  {isRunning ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetTimer}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button variant="outline" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-2" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Fullscreen
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!isFullscreen && !currentTask && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Duration (minutes): {duration}
                  </label>
                  <Timer className="h-4 w-4" />
                </div>
                <Slider
                  value={[duration]}
                  onValueChange={handleDurationChange}
                  min={5}
                  max={60}
                  step={5}
                  disabled={isRunning || currentTask !== null}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!isFullscreen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Session History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {session.task_description || 'Focus Session'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(session.completed_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.floor(session.duration / 60)} minutes
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}