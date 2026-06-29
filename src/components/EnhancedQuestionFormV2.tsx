import React, { useState, useRef, useEffect } from 'react';
import { RichTextDisplay } from './RichTextDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Type, Calculator, AlignLeft, Trash2, Image as ImageIcon, Upload, Download, FileJson, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Question } from '@/types';
import { MathSymbolToolbar, processMathText, convertToUnicode, processRichTextPaste } from './MathFormulaProcessor';
import { ImageUploadField } from './ImageUploadField';

interface EnhancedQuestionFormV2Props {
  onAddQuestion: (question: Question) => void;
  onRemoveQuestion?: (questionId: string) => void;
  onUpdateQuestion?: (question: Question) => void;
  existingQuestions?: Question[];
}

export const EnhancedQuestionFormV2: React.FC<EnhancedQuestionFormV2Props> = ({
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  existingQuestions = []
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  const startEditing = (question: Question) => {
    setEditingId(question.id);
    setCurrentQuestion({
      ...question,
      options: [...question.options],
      optionImages: question.optionImages ? [...question.optionImages] : ['', '', '', ''],
    });
    // Populate the rich-text builder fields imperatively, then scroll up to it
    setTimeout(() => {
      if (questionRichRef.current) questionRichRef.current.innerHTML = question.question || '';
      question.options.forEach((opt, i) => {
        if (optionRichRefs.current[i]) optionRichRefs.current[i]!.innerHTML = opt || '';
      });
      if (explanationRichRef.current) explanationRichRef.current.innerHTML = question.explanation || '';
      builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const resetBuilder = () => {
    if (questionRichRef.current) questionRichRef.current.innerHTML = '';
    optionRichRefs.current.forEach((ref) => { if (ref) ref.innerHTML = ''; });
    if (explanationRichRef.current) explanationRichRef.current.innerHTML = '';
    setCurrentQuestion({
      id: '',
      question: '',
      questionImage: '',
      options: ['', '', '', ''],
      optionImages: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      explanationImage: '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    resetBuilder();
  };

  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: '',
    question: '',
    questionImage: '',
    options: ['', '', '', ''],
    optionImages: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    explanationImage: '',
  });

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const questionRichRef = useRef<HTMLDivElement>(null);
  const optionRichRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const explanationRichRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const [activeMathField, setActiveMathField] = useState<{field: 'question' | 'explanation' | 'option', index?: number} | null>(null);

  // Enhanced text processing for math/science content
  const enhancedProcessText = (text: string): string => {
    // First apply basic processing
    let processed = processMathText(text);
    
    // Then convert common patterns to unicode
    processed = convertToUnicode(processed);
    
    // Handle special formatting patterns
    processed = processed
      // Preserve scientific notation
      .replace(/(\d+(?:\.\d+)?)[eE]([+-]?\d+)/g, '$1×10$2')
      // Handle chemical formulas (preserve subscripts in compounds)
      .replace(/(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Y|Zr|Nb|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I|Xe|Cs|Ba|La|Ce|Pr|Nd|Pm|Sm|Eu|Gd|Tb|Dy|Ho|Er|Tm|Yb|Lu|Hf|Ta|W|Re|Os|Ir|Pt|Au|Hg|Tl|Pb|Bi|Po|At|Rn|Fr|Ra|Ac|Th|Pa|U|Np|Pu|Am|Cm|Bk|Cf|Es|Fm|Md|No|Lr|Rf|Db|Sg|Bh|Hs|Mt|Ds|Rg|Cn|Nh|Fl|Mc|Lv|Ts|Og)(\d+)/g, '$1$2')
      // Handle fractions in text format
      .replace(/(\d+)\/(\d+)/g, (match, num, den) => {
        const fractionMap: {[key: string]: string} = {
          '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
          '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘', '1/6': '⅙', '5/6': '⅚',
          '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
        };
        return fractionMap[match] || match;
      });
    
    return processed;
  };

  const sanitizeHTML = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unsafe tags
    const unsafeTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta'];
    unsafeTags.forEach(tag => doc.querySelectorAll(tag).forEach(n => n.remove()));
    
    // Remove event handler attributes
    doc.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });

    // Hide KaTeX duplicate content
    doc.querySelectorAll('.katex-html').forEach(el => (el as HTMLElement).style.display = 'none');
    
    return doc.body.innerHTML;
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: 'question' | 'explanation' | 'option',
    index?: number
  ) => {
    e.preventDefault();
    
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');
    let pastedContent = '';
    
    if (htmlData && htmlData.trim()) {
      pastedContent = sanitizeHTML(htmlData);
    } else if (textData) {
      // Convert plain text to HTML preserving line breaks
      pastedContent = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    if (!pastedContent) return;
    
    if (field === 'question') {
      setCurrentQuestion(prev => ({ ...prev, question: prev.question + pastedContent }));
    } else if (field === 'explanation') {
      setCurrentQuestion(prev => ({ ...prev, explanation: prev.explanation + pastedContent }));
    } else if (field === 'option' && typeof index === 'number') {
      const newOptions = [...currentQuestion.options];
      newOptions[index] = newOptions[index] + pastedContent;
      setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    }
    
    toast.success('Content pasted with formatting preserved!');
  };

  // Rich paste handler for contentEditable fields
  const handleRichPaste = (
    e: React.ClipboardEvent<HTMLDivElement>,
    field: 'question' | 'explanation' | 'option',
    index?: number
  ) => {
    e.preventDefault();

    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');
    let pastedContent = '';

    if (htmlData && htmlData.trim()) {
      pastedContent = sanitizeHTML(htmlData);
    } else if (textData) {
      pastedContent = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    if (!pastedContent) return;

    // Insert at cursor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = pastedContent;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      range.insertNode(frag);
      range.collapse(false);
    }

    // Sync state from the target element
    const target = e.currentTarget;
    if (field === 'question') {
      setCurrentQuestion(prev => ({ ...prev, question: target.innerHTML }));
    } else if (field === 'explanation') {
      setCurrentQuestion(prev => ({ ...prev, explanation: target.innerHTML }));
    } else if (field === 'option' && typeof index === 'number') {
      const newOptions = [...currentQuestion.options];
      newOptions[index] = target.innerHTML;
      setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    }

    toast.success('Content pasted with formatting preserved!');
  };

  const handleRichInput = () => {
    if (!questionRichRef.current) return;
    setCurrentQuestion(prev => ({ ...prev, question: questionRichRef.current!.innerHTML }));
  };

  // Convert text to superscript unicode
  const convertToSuperscript = (text: string): string => {
    const superscriptMap: {[key: string]: string} = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
      '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
      '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ',
      'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
      'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
      'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
      'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ'
    };
    
    return text.split('').map(char => superscriptMap[char.toLowerCase()] || char).join('');
  };

  // Convert text to subscript unicode
  const convertToSubscript = (text: string): string => {
    const subscriptMap: {[key: string]: string} = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
      '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
      '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ',
      'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ',
      'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
      'v': 'ᵥ', 'x': 'ₓ'
    };
    
    return text.split('').map(char => subscriptMap[char.toLowerCase()] || char).join('');
  };

  const insertMathSymbol = (symbol: string) => {
    if (!activeMathField) return;

    if (activeMathField.field === 'question') {
      // Insert into contentEditable question editor
      const el = questionRichRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(symbol));
        range.collapse(false);
      } else {
        el.innerHTML += symbol;
      }
      setCurrentQuestion(prev => ({ ...prev, question: el.innerHTML }));
      return;
    }
    
    // Default: textarea/input fields
    let targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement> | null = null;
    if (activeMathField.field === 'explanation') {
      targetRef = explanationRef;
    } else if (activeMathField.field === 'option' && typeof activeMathField.index === 'number') {
      targetRef = { current: optionRefs.current[activeMathField.index] };
    }
    if (!targetRef?.current) return;
    const target = targetRef.current;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const currentValue = target.value;
    const newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end);
    if (activeMathField.field === 'explanation') {
      setCurrentQuestion(prev => ({ ...prev, explanation: newValue }));
    } else if (activeMathField.field === 'option' && typeof activeMathField.index === 'number') {
      const newOptions = [...currentQuestion.options];
      newOptions[activeMathField.index] = newValue;
      setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    }
    setTimeout(() => {
      target.focus();
      target.selectionStart = target.selectionEnd = start + symbol.length;
    }, 0);
  };

  // Process HTML content to preserve mathematical symbols and formatting (for textarea fields)
  const processHTMLForMath = (element: HTMLElement): string => {
    let result = '';
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        switch (tagName) {
          case 'sup': {
            const supText = el.textContent || '';
            result += convertToSuperscript(supText);
            break;
          }
          case 'sub': {
            const subText = el.textContent || '';
            result += convertToSubscript(subText);
            break;
          }
          case 'math':
          case 'mfrac':
          case 'msup':
          case 'msub':
          case 'mrow':
          case 'mi':
          case 'mn':
          case 'mo':
          case 'i':
          case 'em':
          case 'b':
          case 'strong':
          case 'span':
            result += processHTMLForMath(el);
            break;
          case 'br':
            result += '\n';
            break;
          case 'p':
          case 'div':
            result += processHTMLForMath(el) + '\n';
            break;
          default:
            result += processHTMLForMath(el);
            break;
        }
      }
    }
    return result;
  };


  const stripHTMLForValidation = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const addQuestionToTest = () => {
    // Sync from contentEditable refs before validation
    const questionHTML = questionRichRef.current?.innerHTML || currentQuestion.question;
    const optionsHTML = currentQuestion.options.map((opt, i) => 
      optionRichRefs.current[i]?.innerHTML || opt
    );
    const explanationHTML = explanationRichRef.current?.innerHTML || currentQuestion.explanation;

    if (!stripHTMLForValidation(questionHTML).trim() || 
        optionsHTML.some(opt => !stripHTMLForValidation(opt).trim())) {
      toast.error('Please fill all question and option fields');
      return;
    }

    if (editingId) {
      const updatedQuestion: Question = {
        ...currentQuestion,
        id: editingId,
        question: questionHTML,
        options: optionsHTML,
        explanation: explanationHTML,
      };
      onUpdateQuestion?.(updatedQuestion);
      setEditingId(null);
      resetBuilder();
      toast.success('Question updated!');
      return;
    }

    const normalizedQuestion: Question = {
      ...currentQuestion,
      id: Date.now().toString(),
      question: questionHTML,
      options: optionsHTML,
      explanation: explanationHTML,
    };

    onAddQuestion(normalizedQuestion);
    resetBuilder();
    toast.success('Question added to test!');
  };

  const jsonFileRef = useRef<HTMLInputElement>(null);

  const downloadJSONTemplate = () => {
    const sample = [
      {
        question: "What is 2 + 2?",
        questionImage: "",
        options: ["3", "4", "5", "6"],
        optionImages: ["", "", "", ""],
        correctAnswer: 1,
        explanation: "2 + 2 equals 4."
      },
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Earth", "Mars", "Jupiter", "Venus"],
        correctAnswer: 1,
        explanation: "Mars appears red due to iron oxide on its surface."
      }
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJSONImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : null);
      if (!arr) {
        toast.error('JSON must be an array of questions or an object with a "questions" array');
        return;
      }

      let added = 0;
      let skipped = 0;
      arr.forEach((q: any, i: number) => {
        // Normalize alternate formats (e.g. question_en/question_bn, options as {A,B,C,D}, answer as letter)
        const norm: any = { ...q };

        // Question text: prefer question, else combine question_en + question_bn
        if (!norm.question) {
          const qEn = typeof q.question_en === 'string' ? q.question_en.trim() : '';
          const qBn = typeof q.question_bn === 'string' ? q.question_bn.trim() : '';
          if (qEn || qBn) {
            norm.question = [qEn, qBn].filter(Boolean).join('<br/>');
          }
        }

        // Options: support object {A,B,C,D} -> array
        if (!Array.isArray(norm.options) && norm.options && typeof norm.options === 'object') {
          const keys = ['A', 'B', 'C', 'D'];
          norm.options = keys.map((k) => String(norm.options[k] ?? norm.options[k.toLowerCase()] ?? ''));
        }

        // Answer: support letter (A/B/C/D) -> index, numeric index, or exact option text
        if (norm.correctAnswer === undefined || norm.correctAnswer === null || norm.correctAnswer === '') {
          const ans = q.answer ?? q.correct ?? q.correct_answer;
          const opts = Array.isArray(norm.options) ? norm.options.map((o: any) => String(o ?? '').trim()) : [];
          if (typeof ans === 'string') {
            const trimmedAns = ans.trim();
            // 1) Exact match against option text (handles "9000", "7.5°", "₹20", etc.)
            let matchIndex = opts.findIndex((opt: string) => opt === trimmedAns);
            // 2) Case-insensitive match
            if (matchIndex < 0) {
              matchIndex = opts.findIndex((opt: string) => opt.toLowerCase() === trimmedAns.toLowerCase());
            }
            if (matchIndex >= 0) {
              norm.correctAnswer = matchIndex;
            } else if (/^[A-D]$/i.test(trimmedAns)) {
              norm.correctAnswer = ['A', 'B', 'C', 'D'].indexOf(trimmedAns.toUpperCase());
            } else if (/^[0-3]$/.test(trimmedAns)) {
              norm.correctAnswer = Number(trimmedAns);
            }
          } else if (typeof ans === 'number') {
            if (ans >= 0 && ans <= 3) {
              norm.correctAnswer = ans;
            } else {
              const matchIndex = opts.findIndex((opt: string) => opt === String(ans));
              if (matchIndex >= 0) norm.correctAnswer = matchIndex;
            }
          }
        }

        // Explanation: prefer explanation, else combine explanation_en + explanation_bn
        if (!norm.explanation) {
          const eEn = typeof q.explanation_en === 'string' ? q.explanation_en.trim() : '';
          const eBn = typeof q.explanation_bn === 'string' ? q.explanation_bn.trim() : '';
          if (eEn || eBn) {
            norm.explanation = [eEn, eBn].filter(Boolean).join('<br/>');
          }
        }

        const questionText = typeof norm.question === 'string' ? norm.question.trim() : '';
        const options = Array.isArray(norm.options) ? norm.options.map((o: any) => String(o ?? '')) : [];
        const correct = Number(norm.correctAnswer);
        if (!questionText || options.length !== 4 || options.some((o: string) => !o.trim()) || isNaN(correct) || correct < 0 || correct > 3) {
          skipped++;
          console.warn(`Skipping question ${i + 1}: invalid format`);
          return;
        }
        const newQ: Question = {
          id: `${Date.now()}-${i}`,
          question: questionText,
          questionImage: typeof norm.questionImage === 'string' ? norm.questionImage : '',
          options,
          optionImages: Array.isArray(norm.optionImages) && norm.optionImages.length === 4
            ? norm.optionImages.map((u: any) => String(u ?? ''))
            : ['', '', '', ''],
          correctAnswer: correct,
          explanation: typeof norm.explanation === 'string' ? norm.explanation : '',
          explanationImage: typeof norm.explanationImage === 'string' ? norm.explanationImage : '',
        };
        onAddQuestion(newQ);
        added++;
      });


      if (added > 0) toast.success(`Imported ${added} question${added > 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`);
      else toast.error('No valid questions found in the file');
    } catch (err) {
      console.error('JSON import error:', err);
      toast.error('Invalid JSON file');
    } finally {
      if (jsonFileRef.current) jsonFileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-5 w-5" />
            Import Questions from JSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a JSON file to bulk-add questions. Each question needs <code>question</code>, <code>options</code> (4 items), <code>correctAnswer</code> (0-3), and optional <code>explanation</code>, <code>questionImage</code>, <code>optionImages</code> (URLs).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => jsonFileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload JSON
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={downloadJSONTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <input
              ref={jsonFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleJSONImport}
            />
          </div>
        </CardContent>
      </Card>

      <Card ref={builderRef}>
        {editingId && (
          <div className="mx-6 mt-4 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm text-primary font-medium">
            Editing question — make your changes and click "Update Enhanced Question to Test".
          </div>
        )}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Enhanced Question Builder with Images & Math
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Math Symbols Toolbar */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Math & Science Symbols
            </Label>
            <MathSymbolToolbar 
              onSymbolInsert={insertMathSymbol}
              activeField={activeMathField?.field || null}
            />
            <p className="text-xs text-muted-foreground">
              Click on any text field below, then select a symbol. Auto-formatting converts text like "pi", "alpha", "^2", "_1" into proper symbols.
            </p>
          </div>

          {/* Question Field with Image */}
          <div className="space-y-4">
            <Label htmlFor="question-text" className="flex items-center gap-2">
              <AlignLeft className="h-4 w-4" />
              Question
            </Label>
            
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="space-y-2">
                <div
                  ref={questionRichRef}
                  contentEditable
                  className="rich-text-editor rich-text-content"
                  data-placeholder="Enter your question here... Copy/paste from any source (ChatGPT, Word, Google Docs) - formatting will be preserved!"
                  onInput={handleRichInput}
                  onPaste={(e) => handleRichPaste(e, 'question')}
                  onFocus={() => setActiveMathField({field: 'question'})}
                  dangerouslySetInnerHTML={
                    !questionRichRef.current && currentQuestion.question
                      ? { __html: currentQuestion.question }
                      : undefined
                  }
                />
              </TabsContent>
              
              <TabsContent value="image">
                <ImageUploadField
                  label="Question Image"
                  value={currentQuestion.questionImage}
                  onChange={(imageUrl) => setCurrentQuestion(prev => ({ ...prev, questionImage: imageUrl }))}
                  onRemove={() => setCurrentQuestion(prev => ({ ...prev, questionImage: '' }))}
                  placeholder="Upload or enter URL for question image"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label>Answer Options</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <Label htmlFor={`option-${index}`} className="font-medium">
                    Option {index + 1}
                  </Label>
                  
                  <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="text">Text</TabsTrigger>
                      <TabsTrigger value="image">Image</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="text" className="space-y-2">
                      <div
                        ref={(el) => { optionRichRefs.current[index] = el; }}
                        contentEditable
                        className="rich-text-editor rich-text-content min-h-[40px]"
                        style={{ minHeight: '40px' }}
                        data-placeholder={`Option ${index + 1} - copy/paste content directly`}
                        onBlur={(e) => {
                          const newOptions = [...currentQuestion.options];
                          newOptions[index] = e.currentTarget.innerHTML;
                          setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
                        }}
                        onPaste={(e) => handleRichPaste(e, 'option', index)}
                        onFocus={() => setActiveMathField({field: 'option', index})}
                      />
                    </TabsContent>
                    
                    <TabsContent value="image">
                      <ImageUploadField
                        label={`Option ${index + 1} Image`}
                        value={currentQuestion.optionImages?.[index]}
                        onChange={(imageUrl) => {
                          const newImages = [...(currentQuestion.optionImages || ['', '', '', ''])];
                          newImages[index] = imageUrl;
                          setCurrentQuestion(prev => ({ ...prev, optionImages: newImages }));
                        }}
                        onRemove={() => {
                          const newImages = [...(currentQuestion.optionImages || ['', '', '', ''])];
                          newImages[index] = '';
                          setCurrentQuestion(prev => ({ ...prev, optionImages: newImages }));
                        }}
                        placeholder={`Upload or enter URL for option ${index + 1} image`}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              ))}
            </div>
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

          {/* Explanation Field with Image */}
          <div className="space-y-4">
            <Label htmlFor="explanation">Explanation (Optional)</Label>
            
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="space-y-2">
                <div
                  ref={explanationRichRef}
                  contentEditable
                  className="rich-text-editor rich-text-content min-h-[80px]"
                  data-placeholder="Explain why this is the correct answer... Copy/paste with preserved formatting!"
                  onBlur={(e) => setCurrentQuestion(prev => ({ ...prev, explanation: e.currentTarget.innerHTML }))}
                  onPaste={(e) => handleRichPaste(e, 'explanation')}
                  onFocus={() => setActiveMathField({field: 'explanation'})}
                />
              </TabsContent>
              
              <TabsContent value="image">
                <ImageUploadField
                  label="Explanation Image"
                  value={currentQuestion.explanationImage}
                  onChange={(imageUrl) => setCurrentQuestion(prev => ({ ...prev, explanationImage: imageUrl }))}
                  onRemove={() => setCurrentQuestion(prev => ({ ...prev, explanationImage: '' }))}
                  placeholder="Upload or enter URL for explanation image"
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex gap-2">
            <Button onClick={addQuestionToTest} className="flex-1">
              {editingId ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Enhanced Question to Test
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Enhanced Question to Test
                </>
              )}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions Preview - Enhanced */}
      {existingQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Questions Added ({existingQuestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingQuestions.map((question, index) => {
              const isEditing = editingId === question.id;
              return (
              <Card key={question.id} className={`border-l-4 ${isEditing ? 'border-l-primary ring-2 ring-primary/40' : 'border-l-primary'}`}>

                <CardContent className="pt-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start gap-2">
                        <Badge variant="secondary" className="text-xs font-mono">
                          Q{index + 1}
                        </Badge>
                        <div className="space-y-2 flex-1">
                          <RichTextDisplay content={question.question} className="font-medium leading-relaxed" as="div" />
                          {question.questionImage && (
                            <img 
                              src={question.questionImage} 
                              alt="Question" 
                              className="max-w-xs rounded border" 
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 ml-6">

                        {question.options.map((option, optIndex) => (
                          <div key={optIndex} className={`p-2 rounded ${
                            optIndex === question.correctAnswer 
                              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                              : 'bg-muted/50'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {String.fromCharCode(65 + optIndex)}:
                              </span>
                              <RichTextDisplay 
                                content={option} 
                                className={optIndex === question.correctAnswer ? 'font-medium text-green-700 dark:text-green-300' : ''} 
                              />
                              {optIndex === question.correctAnswer && (
                                <span className="text-green-600 font-bold">✓</span>
                              )}
                            </div>
                            {question.optionImages?.[optIndex] && (
                              <img 
                                src={question.optionImages[optIndex]} 
                                alt={`Option ${optIndex + 1}`} 
                                className="max-w-32 mt-1 rounded border ml-4" 
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      
                      {(question.explanation || question.explanationImage) && (
                        <div className="ml-6 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md space-y-2">
                          {question.explanation && (
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                              <strong className="text-blue-900 dark:text-blue-100">Explanation:</strong>{' '}
                              <RichTextDisplay content={question.explanation} />
                            </div>
                          )}
                          {question.explanationImage && (
                            <img 
                              src={question.explanationImage} 
                              alt="Explanation" 
                              className="max-w-xs rounded border" 
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {onUpdateQuestion && (
                        <Button
                          variant={isEditing ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => startEditing(question)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
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

                  </div>
                </CardContent>
              </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
