import { useMemo } from "react";
import { BookOpen, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Test, TestAttempt } from "@/types";

interface TopicProgress {
  topic: string;
  attempted: number;
  correct: number;
  accuracy: number;
  practiceTest?: Test;
}

interface Props {
  tests: Test[];
  attempts: TestAttempt[];
  onPractice: (test: Test) => void;
}

export const LearningPlan = ({ tests, attempts, onPractice }: Props) => {
  const topics = useMemo<TopicProgress[]>(() => {
    const testById = new Map(tests.map((test) => [test.id, test]));
    const grouped = new Map<string, { attempted: number; correct: number }>();

    attempts.forEach((attempt) => {
      const test = testById.get(attempt.testId);
      if (!test) return;
      test.questions.forEach((question, index) => {
        const topic = question.lessonPlanCategory?.trim();
        const answer = Number(attempt.answers[index]);
        if (!topic || !Number.isFinite(answer) || answer < 0) return;
        const current = grouped.get(topic) || { attempted: 0, correct: 0 };
        current.attempted += 1;
        if (answer === Number(question.correctAnswer)) current.correct += 1;
        grouped.set(topic, current);
      });
    });

    return [...grouped.entries()]
      .map(([topic, progress]) => {
        const practiceTest = tests.find((test) => test.questions.some((question) => question.lessonPlanCategory?.trim() === topic));
        return {
          topic,
          ...progress,
          accuracy: Math.round((progress.correct / progress.attempted) * 100),
          practiceTest,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy || a.attempted - b.attempted)
      .slice(0, 3);
  }, [attempts, tests]);

  return (
    <Card id="learning-plan">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> My Learning Plan</CardTitle>
        <CardDescription>Focus on the lesson areas where your answered questions show the most room to improve.</CardDescription>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Your plan will appear after you complete a test with lesson-plan categories. Ask your teacher to add a category such as “Fractions – application” to questions.
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <div key={topic.topic} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{topic.topic}</p>
                    <p className="text-xs text-muted-foreground mt-1">{topic.correct} correct out of {topic.attempted} answered</p>
                  </div>
                  <Badge variant={topic.accuracy < 50 ? "destructive" : topic.accuracy < 75 ? "secondary" : "default"}>{topic.accuracy}% accuracy</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {topic.accuracy < 50 ? "Start with the lesson notes and solved examples, then practise slowly." : topic.accuracy < 75 ? "Review the mistakes, then practise similar questions with a time limit." : "Keep this strength fresh with one short practice round."}
                </p>
                {topic.practiceTest && (
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => onPractice(topic.practiceTest!)}>
                    <BookOpen className="mr-2 h-4 w-4" /> Practice with {topic.practiceTest.title}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
