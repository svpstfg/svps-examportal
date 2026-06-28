import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Type, Calculator, AlignLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Question } from '@/types';

interface EnhancedQuestionFormProps {
  onAddQuestion: (question: Question) => void;
  onRemoveQuestion?: (questionId: string) => void;
  existingQuestions?: Question[];
}

export const EnhancedQuestionForm: React.FC<EnhancedQuestionFormProps> = ({
  onAddQuestion,
  onRemoveQuestion,
  existingQuestions = []
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: '',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
  });

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  // Math symbols commonly used in tests
  const mathSymbols = [
    { symbol: '√', label: 'Square root' },
    { symbol: 'π', label: 'Pi' },
    { symbol: '∞', label: 'Infinity' },
    { symbol: '±', label: 'Plus minus' },
    { symbol: '≈', label: 'Approximately' },
    { symbol: '≠', label: 'Not equal' },
    { symbol: '≤', label: 'Less than or equal' },
    { symbol: '≥', label: 'Greater than or equal' },
    { symbol: '²', label: 'Superscript 2' },
    { symbol: '³', label: 'Superscript 3' },
    { symbol: '⁴', label: 'Superscript 4' },
    { symbol: '½', label: 'One half' },
    { symbol: '¼', label: 'One quarter' },
    { symbol: '¾', label: 'Three quarters' },
    { symbol: '°', label: 'Degree' },
    { symbol: 'α', label: 'Alpha' },
    { symbol: 'β', label: 'Beta' },
    { symbol: 'γ', label: 'Gamma' },
    { symbol: 'Δ', label: 'Delta' },
    { symbol: 'θ', label: 'Theta' }
  ];

  // Text processing functions
  const normalizeText = (text: string): string => {
    // Remove duplicate italic markers and normalize formatting
    return text
      .replace(/\*\*\*/g, '**') // Triple asterisks to double
      .replace(/___/g, '__') // Triple underscores to double
      .replace(/\*\*\*\*/g, '**') // Quadruple asterisks to double
      .replace(/____/g, '__') // Quadruple underscores to double
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .trim();
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: 'question' | 'explanation' | 'option',
    index?: number
  ) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const normalizedText = normalizeText(pastedText);
    
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const currentValue = target.value;
    
    const newValue = currentValue.substring(0, start) + normalizedText + currentValue.substring(end);
    
    if (field === 'question') {
      setCurrentQuestion(prev => ({ ...prev, question: newValue }));
    } else if (field === 'explanation') {
      setCurrentQuestion(prev => ({ ...prev, explanation: newValue }));
    } else if (field === 'option' && typeof index === 'number') {
      const newOptions = [...currentQuestion.options];
      newOptions[index] = newValue;
      setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    }
    
    // Set cursor position after paste
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + normalizedText.length;
    }, 0);
  };

  const insertMathSymbol = (symbol: string, targetField: 'question' | 'explanation' | 'option', optionIndex?: number) => {
    let targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement> | null = null;
    
    if (targetField === 'question') {
      targetRef = questionRef;
    } else if (targetField === 'explanation') {
      targetRef = explanationRef;
    } else if (targetField === 'option' && typeof optionIndex === 'number') {
      targetRef = { current: optionRefs.current[optionIndex] };
    }
    
    if (!targetRef?.current) return;
    
    const target = targetRef.current;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const currentValue = target.value;
    
    const newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end);
    
    if (targetField === 'question') {
      setCurrentQuestion(prev => ({ ...prev, question: newValue }));
    } else if (targetField === 'explanation') {
      setCurrentQuestion(prev => ({ ...prev, explanation: newValue }));
    } else if (targetField === 'option' && typeof optionIndex === 'number') {
      const newOptions = [...currentQuestion.options];
      newOptions[optionIndex] = newValue;
      setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    }
    
    // Set cursor position after symbol
    setTimeout(() => {
      target.focus();
      target.selectionStart = target.selectionEnd = start + symbol.length;
    }, 0);
  };

  const addQuestionToTest = () => {
    if (!currentQuestion.question.trim() || currentQuestion.options.some(opt => !opt.trim())) {
      toast.error('Please fill all question fields');
      return;
    }

    // Normalize all text fields before adding
    const normalizedQuestion: Question = {
      ...currentQuestion,
      id: Date.now().toString(),
      question: normalizeText(currentQuestion.question),
      options: currentQuestion.options.map(opt => normalizeText(opt)),
      explanation: normalizeText(currentQuestion.explanation)
    };

    onAddQuestion(normalizedQuestion);

    setCurrentQuestion({
      id: '',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
    });

    toast.success('Question added to test!');
  };

  const [activeMathField, setActiveMathField] = useState<{field: 'question' | 'explanation' | 'option', index?: number} | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Enhanced Question Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Math Symbols Toolbar */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Math Symbols
            </Label>
            <div className="flex flex-wrap gap-1 p-3 bg-muted rounded-md">
              {mathSymbols.map((item) => (
                <Button
                  key={item.symbol}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-sm"
                  onClick={() => {
                    if (activeMathField) {
                      insertMathSymbol(item.symbol, activeMathField.field, activeMathField.index);
                    } else {
                      toast.info('Click on a text field first, then select a symbol');
                    }
                  }}
                  title={item.label}
                >
                  {item.symbol}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click on any text field below, then click a symbol to insert it at the cursor position.
            </p>
          </div>

          {/* Question Field */}
          <div className="space-y-2">
            <Label htmlFor="question-text" className="flex items-center gap-2">
              <AlignLeft className="h-4 w-4" />
              Question
            </Label>
            <Textarea 
              ref={questionRef}
              id="question-text"
              value={currentQuestion.question}
              onChange={(e) => setCurrentQuestion(prev => ({ ...prev, question: e.target.value }))}
              onPaste={(e) => handlePaste(e, 'question')}
              onFocus={() => setActiveMathField({field: 'question'})}
              placeholder="Enter your question here... (supports copy/paste with automatic formatting)"
              className="min-h-[100px] resize-y"
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`option-${index}`}>Option {index + 1}</Label>
                <Input 
                  ref={(el) => optionRefs.current[index] = el}
                  id={`option-${index}`}
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...currentQuestion.options];
                    newOptions[index] = e.target.value;
                    setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
                  }}
                  onPaste={(e) => handlePaste(e, 'option', index)}
                  onFocus={() => setActiveMathField({field: 'option', index})}
                  placeholder={`Option ${index + 1}`}
                />
              </div>
            ))}
          </div>

          {/* Correct Answer */}
          <div className="space-y-2">
            <Label htmlFor="correct-answer">Correct Answer</Label>
            <Select 
              value={currentQuestion.correctAnswer.toString()} 
              onValueChange={(value) => setCurrentQuestion(prev => ({ ...prev, correctAnswer: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select correct option" />
              </SelectTrigger>
              <SelectContent>
                {currentQuestion.options.map((option, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    Option {index + 1}: {option || `Option ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (Optional)</Label>
            <Textarea 
              ref={explanationRef}
              id="explanation"
              value={currentQuestion.explanation}
              onChange={(e) => setCurrentQuestion(prev => ({ ...prev, explanation: e.target.value }))}
              onPaste={(e) => handlePaste(e, 'explanation')}
              onFocus={() => setActiveMathField({field: 'explanation'})}
              placeholder="Explain why this is the correct answer... (supports math symbols and formatting)"
              className="min-h-[80px] resize-y"
            />
          </div>

          <Button onClick={addQuestionToTest} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Question to Test
          </Button>
        </CardContent>
      </Card>

      {/* Questions Preview */}
      {existingQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Questions Added ({existingQuestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingQuestions.map((question, index) => (
              <Card key={question.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start gap-2">
                        <Badge variant="secondary" className="text-xs font-mono">
                          Q{index + 1}
                        </Badge>
                        <p className="font-medium leading-relaxed">{question.question}</p>
                      </div>
                      <div className="space-y-1 ml-6">
                        {question.options.map((option, optIndex) => (
                          <p 
                            key={optIndex} 
                            className={`text-sm flex items-center gap-2 ${
                              optIndex === question.correctAnswer 
                                ? 'text-green-600 font-medium bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded' 
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span className="font-mono text-xs">
                              {String.fromCharCode(65 + optIndex)}:
                            </span>
                            {option} 
                            {optIndex === question.correctAnswer && (
                              <span className="text-green-600 font-bold">✓</span>
                            )}
                          </p>
                        ))}
                      </div>
                      {question.explanation && (
                        <div className="ml-6 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong className="text-blue-900 dark:text-blue-100">Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                    {onRemoveQuestion && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onRemoveQuestion(question.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};