import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Save, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Test, Question, Chapter, Course, Class } from "@/types";
import { EnhancedQuestionFormV2 } from "@/components/EnhancedQuestionFormV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestEditorProps {
  test: Test;
  chapters: Chapter[];
  courses: Course[];
  classes: Class[];
  onSave: (test: Test) => void;
  onCancel: () => void;
}

export const TestEditor = ({ test, chapters, courses, classes, onSave, onCancel }: TestEditorProps) => {
  const [editingTest, setEditingTest] = useState<Test>(test);
  const [loading, setLoading] = useState(false);

  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  };

  const getAvailableChapters = () => {
    return chapters.filter(chapter => 
      courses.some(course => 
        course.id === chapter.courseId && 
        classes.some(cls => cls.id === course.classId)
      )
    );
  };

  const addQuestionToTest = (question: Question) => {
    setEditingTest(prev => ({
      ...prev,
      questions: [...prev.questions, question]
    }));
  };

  const removeQuestionFromTest = (questionId: string) => {
    setEditingTest(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const updateQuestionInTest = (question: Question) => {
    setEditingTest(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === question.id ? question : q)
    }));
  };


  const handleSaveTest = async () => {
    if (!editingTest.title || !editingTest.chapterId || editingTest.questions.length === 0) {
      toast.error('Please fill in all required fields and add at least one question');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tests')
        .update({
          title: editingTest.title,
          duration: editingTest.duration,
          chapter_id: editingTest.chapterId,
          questions: editingTest.questions as any,
          scheduled_date: editingTest.scheduledDate?.toISOString().split('T')[0] || null,
          scheduled_time: editingTest.scheduledTime || null,
          is_scheduled: editingTest.isScheduled,
          is_pro: editingTest.isPro,
        })
        .eq('id', editingTest.id);

      if (error) throw error;

      toast.success('Test updated successfully!');
      onSave(editingTest);
    } catch (error) {
      console.error('Error updating test:', error);
      toast.error('Failed to update test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tests
          </Button>
          <h2 className="text-2xl font-semibold">Edit Test</h2>
        </div>
        <Button onClick={handleSaveTest} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Test'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Information</CardTitle>
          <CardDescription>Edit the basic details of your test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-title">Test Title</Label>
              <Input 
                id="test-title"
                value={editingTest.title}
                onChange={(e) => setEditingTest(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Linear Equations Quiz" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-duration">Duration (minutes)</Label>
              <Input 
                id="test-duration"
                type="number"
                value={editingTest.duration}
                onChange={(e) => setEditingTest(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-chapter">Select Chapter</Label>
              <Select 
                value={editingTest.chapterId} 
                onValueChange={(value) => setEditingTest(prev => ({ ...prev, chapterId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a chapter" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableChapters().map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.name} ({getCourseName(chapter.courseId)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pro & Scheduling Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pro-test"
                  checked={editingTest.isPro}
                  onChange={(e) => setEditingTest(prev => ({ ...prev, isPro: e.target.checked }))}
                />
                <Label htmlFor="pro-test" className="flex items-center gap-1">
                  Pro-only test
                  <span className="text-xs text-muted-foreground">(only available to Pro students)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="schedule-test"
                  checked={editingTest.isScheduled}
                  onChange={(e) => setEditingTest(prev => ({ ...prev, isScheduled: e.target.checked }))}
                />
                <Label htmlFor="schedule-test">Schedule this test</Label>
              </div>
            </div>

            {editingTest.isScheduled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editingTest.scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editingTest.scheduledDate ? format(editingTest.scheduledDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarUI
                        mode="single"
                        selected={editingTest.scheduledDate}
                        onSelect={(date) => setEditingTest(prev => ({ ...prev, scheduledDate: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-time">Scheduled Time</Label>
                  <Input 
                    id="scheduled-time"
                    type="time"
                    value={editingTest.scheduledTime || ''}
                    onChange={(e) => setEditingTest(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Management */}
      <EnhancedQuestionFormV2 
        onAddQuestion={addQuestionToTest}
        onRemoveQuestion={removeQuestionFromTest}
        onUpdateQuestion={updateQuestionInTest}
        existingQuestions={editingTest.questions}
      />
    </div>
  );
};