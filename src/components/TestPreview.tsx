import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Test, Question } from "@/types";
import { RichTextDisplay } from "./RichTextDisplay";
import { isAnswered, isAnswerCorrect } from "@/lib/answers";

interface TestPreviewProps {
  test: Test;
  onClose: () => void;
}

export const TestPreview = ({ test, onClose }: TestPreviewProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(
    new Array(test.questions.length).fill(-1)
  );
  const [showResults, setShowResults] = useState(false);

  const question = test.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100;

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  if (showResults) {
    const score = selectedAnswers.reduce((total, answer, index) => {
      return total + (Number(answer) === Number(test.questions[index].correctAnswer) ? 1 : 0);
    }, 0);
    const percentage = test.questions.length > 0 ? Math.round((score / test.questions.length) * 100) : 0;

    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-sm">👁 Preview Mode</Badge>
            <Button variant="outline" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tests
            </Button>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Test Preview Results</CardTitle>
              <CardDescription>{test.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 text-center mb-6">
                <div>
                  <div className="text-3xl font-bold text-primary">{percentage}%</div>
                  <p className="text-muted-foreground">Score</p>
                </div>
                <div>
                  <div className="text-3xl font-bold">{score}/{test.questions.length}</div>
                  <p className="text-muted-foreground">Correct Answers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {test.questions.map((q, index) => {
                const userAnswer = selectedAnswers[index];
                const isCorrect = isAnswerCorrect(userAnswer, q.correctAnswer);

                return (
                  <div key={q.id} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3 mb-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCorrect ? 'bg-green-500 text-white' : 'bg-destructive text-destructive-foreground'
                      }`}>
                        {isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-2">{index + 1}. <RichTextDisplay content={q.question} /></h3>
                        <div className="grid gap-2 mb-3">
                          {q.options.map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className={`p-2 rounded border ${
                                  Number(q.correctAnswer) === optIndex
                                    ? 'bg-green-500/10 border-green-500'
                                    : Number(userAnswer) === optIndex && !isCorrect
                                    ? 'bg-destructive/10 border-destructive'
                                    : 'bg-muted'
                                }`}
                            >
                              <span className="font-semibold mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                              <RichTextDisplay content={option} />
                              {Number(q.correctAnswer) === optIndex && <Badge className="ml-2">Correct</Badge>}
                              {Number(userAnswer) === optIndex && Number(userAnswer) !== Number(q.correctAnswer) && (
                                <Badge variant="destructive" className="ml-2">Your Answer</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-sm font-medium mb-1">Explanation:</p>
                            <RichTextDisplay content={q.explanation} className="text-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <Button onClick={onClose} className="w-full">Back to Tests</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-sm">👁 Preview Mode — This is how students will see this test</Badge>
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tests
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{test.title}</CardTitle>
                <CardDescription>
                  Question {currentQuestionIndex + 1} of {test.questions.length}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2 text-lg font-mono">
                  <Clock className="h-5 w-5" />
                  <span>{test.duration}:00</span>
                </div>
              </div>
            </div>
            <Progress value={progress} className="mt-4" />
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl"><RichTextDisplay content={question.question} as="div" /></CardTitle>
            {question.questionImage && (
              <img src={question.questionImage} alt="Question" className="mt-2 max-w-full rounded-md" />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {question.options.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedAnswers[currentQuestionIndex] === index ? "default" : "outline"}
                  className="justify-start text-left h-auto p-4"
                  onClick={() => handleAnswerSelect(index)}
                >
                  <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                  <RichTextDisplay content={option} />
                </Button>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(i => i - 1)}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              <div className="flex space-x-3">
                {currentQuestionIndex === test.questions.length - 1 ? (
                  <Button onClick={() => setShowResults(true)}>
                    Submit Test
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentQuestionIndex(i => i + 1)}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
