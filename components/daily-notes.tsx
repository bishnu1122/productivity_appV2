"use client";

import { useState, useEffect } from 'react';
import { useUserStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, Sun, Moon, ChevronRight } from 'lucide-react';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';

interface Note {
  id: number;
  user_name: string;
  content: string;
  type: 'morning' | 'evening';
  date: string;
  created_at: string;
}

export default function DailyNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [morningNote, setMorningNote] = useState('');
  const [eveningNote, setEveningNote] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { userName } = useUserStore();

  const isCurrentDateOrFuture = isAfter(parseISO(selectedDate), startOfDay(new Date())) || 
    format(parseISO(selectedDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchAllNotes();
  }, [userName]);

  useEffect(() => {
    const notesForDate = notes.filter(note => 
      note.date === selectedDate
    );
    
    const morning = notesForDate.find(note => note.type === 'morning');
    const evening = notesForDate.find(note => note.type === 'evening');
    
    setMorningNote(morning?.content || '');
    setEveningNote(evening?.content || '');
  }, [selectedDate, notes]);

  const fetchAllNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_name', userName)
        .order('date', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      toast.error('Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async (type: 'morning' | 'evening', content: string) => {
    if (!content.trim()) return;

    try {
      const existingNote = notes.find(note => 
        note.type === type && note.date === selectedDate
      );
      
      if (existingNote) {
        const { error } = await supabase
          .from('notes')
          .update({ content })
          .eq('id', existingNote.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notes')
          .insert([{
            user_name: userName,
            content,
            type,
            date: selectedDate,
          }]);
        
        if (error) throw error;
      }

      toast.success('Note saved successfully');
      fetchAllNotes();
    } catch (error) {
      toast.error('Failed to save note');
    }
  };

  const uniqueDates = Array.from(new Set(
    notes.map(note => note.date)
  )).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="w-64 shrink-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {uniqueDates.map(date => (
                <Button
                  key={date}
                  variant={date === selectedDate ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedDate(date)}
                >
                  <ChevronRight className="h-4 w-4 mr-2" />
                  {format(parseISO(date), 'MMM d, yyyy')}
                </Button>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Morning Reflection</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="What are your goals for today?"
                value={morningNote}
                onChange={(e) => setMorningNote(e.target.value)}
                rows={4}
                disabled={!isCurrentDateOrFuture}
              />
              {isCurrentDateOrFuture && (
                <Button onClick={() => saveNote('morning', morningNote)}>
                  Save Morning Note
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Evening Reflection</CardTitle>
            <Moon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="How was your day? What did you accomplish?"
                value={eveningNote}
                onChange={(e) => setEveningNote(e.target.value)}
                rows={4}
                disabled={!isCurrentDateOrFuture}
              />
              {isCurrentDateOrFuture && (
                <Button onClick={() => saveNote('evening', eveningNote)}>
                  Save Evening Note
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}