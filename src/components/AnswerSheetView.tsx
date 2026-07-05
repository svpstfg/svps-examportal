import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, CheckCircle, AlertCircle, Clock, Trophy, Target, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Test, TestAttempt, Question } from "@/types";
import { getQuestionRemark, isAnswered, isAnswerCorrect, normalizeQuestionTime } from "@/lib/answers";
import { RichTextDisplay } from "./RichTextDisplay";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface AnswerSheetViewProps {
  attempt: TestAttempt;
  test: Test;
  studentName: string;
  onBack: () => void;
  /** Optional context passed to the AI analysis */
  subject?: string;
  className?: string;
}

export const AnswerSheetView = ({ attempt, test, studentName, onBack, subject, className }: AnswerSheetViewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const correctCount = attempt.answers.reduce((total, answer, index) => {
    return total + (answer === test.questions[index]?.correctAnswer ? 1 : 0);
  }, 0);

  const questionTimes = (attempt.questionTimes || []).map(normalizeQuestionTime);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleDownloadPDF = async () => {
    const content = printRef.current;
    if (!content) return;

    setDownloading(true);
    try {
      await document.fonts.ready;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const totalPdfHeight = canvas.height * ratio;

      let position = 0;
      let remaining = totalPdfHeight;

      while (remaining > 0) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, totalPdfHeight);
        position += pdfHeight;
        remaining -= pdfHeight;
      }

      pdf.save(`${test.title.replace(/\s+/g, '_')}_AnswerSheet.pdf`);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiReport("");
    try {
      const payloadQuestions = test.questions.map((q, i) => {
        const ans = attempt.answers[i];
        return {
          index: i,
          question: q.question || "",
          correct: isAnswerCorrect(ans, q.correctAnswer),
          answered: isAnswered(ans),
          timeSec: normalizeQuestionTime(questionTimes[i] ?? 0),
        };
      });
      const { data, error } = await supabase.functions.invoke("student-analysis", {
        body: {
          studentName,
          testTitle: test.title,
          subject,
          className,
          scorePct: attempt.score,
          fullMarks: test.questions.length,
          marksObtained: correctCount,
          totalTimeSec: attempt.timeSpent,
          questions: payloadQuestions,
        },
      });
      if (error) {
        const msg = (await error.context?.json?.())?.error;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setAiReport(data?.report || "No report generated.");
      toast.success("AI report ready");
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={runAiAnalysis} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {aiLoading ? "Analysing..." : "AI Report"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            🖨️ Print
          </Button>
          <Button onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {downloading ? "Generating PDF..." : "Download as PDF"}
          </Button>
        </div>
      </div>

      {/* On-screen AI report (also captured into the PDF) */}
      {aiReport && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">AI Performance Report</h3>
          </div>
          <div className="text-sm space-y-1 text-foreground">
            {aiReport.split("\n").map((line, idx) => {
              const t = line.trim();
              if (!t) return <div key={idx} className="h-1" />;
              if (t.startsWith("## ")) return <h4 key={idx} className="font-semibold mt-2">{t.replace(/^##\s*/, "")}</h4>;
              if (t.startsWith("# ")) return <h3 key={idx} className="font-bold text-base mt-2">{t.replace(/^#\s*/, "")}</h3>;
              if (t.startsWith("- ") || t.startsWith("* ")) return <li key={idx} className="ml-4 list-disc">{t.replace(/^[-*]\s*/, "")}</li>;
              return <p key={idx}>{t}</p>;
            })}
          </div>
        </div>
      )}

      {/* Printable exam paper layout */}
      <div ref={printRef} className="bg-white text-black">
        {aiReport && (
          <div className="border-2 border-black border-b-0 p-4">
            <h3 className="font-bold text-sm uppercase tracking-wide mb-2">AI Performance Report</h3>
            <div className="text-[11px] leading-snug space-y-1 text-black">
              {aiReport.split("\n").map((line, idx) => {
                const t = line.trim();
                if (!t) return <div key={idx} className="h-1" />;
                if (t.startsWith("## ")) return <p key={idx} className="font-bold mt-1">{t.replace(/^##\s*/, "")}</p>;
                if (t.startsWith("# ")) return <p key={idx} className="font-bold mt-1">{t.replace(/^#\s*/, "")}</p>;
                if (t.startsWith("- ") || t.startsWith("* ")) return <p key={idx} className="ml-3">• {t.replace(/^[-*]\s*/, "")}</p>;
                return <p key={idx}>{t}</p>;
              })}
            </div>
          </div>
        )}
        {/* Exam Header */}
        <div className="border-2 border-black p-6 mb-0">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wide">{test.title}</h1>
            <div className="w-24 h-0.5 bg-black mx-auto my-2"></div>
            <p className="text-sm text-gray-800 font-medium">Answer Sheet &amp; Performance Report</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-300 pt-4">
            <div className="space-y-1">
              <p><span className="font-semibold">Student Name:</span> <span className="border-b border-dotted border-gray-400 pb-0.5 inline-block min-w-[150px]">{studentName}</span></p>
              <p><span className="font-semibold">Date:</span> <span className="border-b border-dotted border-gray-400 pb-0.5 inline-block min-w-[150px]">{format(attempt.completedAt, "dd MMM yyyy, hh:mm a")}</span></p>
            </div>
            <div className="space-y-1 text-right">
              <p><span className="font-semibold">Total Questions:</span> {test.questions.length}</p>
              <p><span className="font-semibold">Duration:</span> {test.duration} min</p>
            </div>
          </div>
        </div>

        {/* Score Box */}
        <div className="border-x-2 border-b-2 border-black p-4">
          <div className="grid grid-cols-3 divide-x divide-gray-300 text-center">
            <div className="px-4">
              <div className="text-3xl font-bold">{attempt.score}%</div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Score Obtained</p>
            </div>
            <div className="px-4">
              <div className="text-3xl font-bold">{correctCount}/{test.questions.length}</div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Correct Answers</p>
            </div>
            <div className="px-4">
              <div className="text-3xl font-bold">{formatTime(attempt.timeSpent)}</div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Time Taken</p>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="border-x-2 border-b-2 border-black bg-gray-900 text-white px-4 py-2">
          <h2 className="font-bold text-sm uppercase tracking-widest text-center">Questions & Answers</h2>
        </div>

        {/* Questions - Two Column Layout */}
        <div className="border-x-2 border-b-2 border-black grid grid-cols-2 gap-0">
          {test.questions.map((question, index) => {
            const userAnswer = attempt.answers[index];
            const isCorrect = isAnswerCorrect(userAnswer, question.correctAnswer);
            const timeSpent = normalizeQuestionTime(questionTimes[index] ?? 0);
            const answered = isAnswered(userAnswer);

            return (
              <div key={question.id || index} className={`p-3 border border-gray-200`}>
                {/* Question */}
                <div className="flex items-start gap-2 mb-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[10px] leading-snug">
                      <RichTextDisplay content={question.question} />
                    </div>
                  </div>
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                </div>

                {question.questionImage && (
                  <img src={question.questionImage} alt="Question" className="max-h-24 rounded mb-2 ml-7" />
                )}

                {/* Options */}
                <div className="ml-7 space-y-1">
                  {question.options.map((option, optIndex) => {
                    const isCorrectOption = Number(question.correctAnswer) === optIndex;
                    const isUserAnswer = Number(userAnswer) === optIndex;
                    const isWrongPick = isUserAnswer && !isCorrect;

                    let optionClass = "flex items-center gap-1.5 py-0.5 px-2 rounded text-[10px]";
                    if (isCorrectOption) optionClass += " bg-green-50 border border-green-400 font-medium";
                    else if (isWrongPick) optionClass += " bg-red-50 border border-red-400 line-through";
                    else optionClass += " border border-gray-200";

                    return (
                      <div key={optIndex} className={optionClass}>
                        <span className="font-bold text-[9px] w-4">({String.fromCharCode(65 + optIndex)})</span>
                        <span className="flex-1"><RichTextDisplay content={option} /></span>
                        {isCorrectOption && <span className="text-green-700 text-[8px] font-bold">✓</span>}
                        {isWrongPick && <span className="text-red-700 text-[8px] font-bold">✗</span>}
                      </div>
                    );
                  })}
                </div>

                {!answered && (
                  <p className="ml-7 mt-1 text-[9px] text-gray-500 italic">⚠ Not Answered</p>
                )}

                <div className="ml-7 mt-2 flex flex-wrap items-center gap-2 text-[9px]">
                  <div className="rounded bg-gray-100 px-2 py-1 text-gray-700">
                    <span className="font-semibold">Time:</span> {formatTime(timeSpent)}
                  </div>
                  <div className={`rounded px-2 py-1 ${!isCorrect || !answered ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    <span className="font-semibold">Remark:</span> {getQuestionRemark(isCorrect, timeSpent, answered)}
                  </div>
                </div>

                {question.explanation && (
                  <div className="ml-7 mt-2 border-l-2 border-blue-400 bg-blue-50 px-2 py-1 rounded-r">
                    <p className="font-semibold text-[8px] text-blue-800 mb-0.5">EXPLANATION</p>
                    <RichTextDisplay content={question.explanation} className="text-gray-700 text-[9px] leading-snug" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-x-2 border-b-2 border-black px-4 py-3 bg-gray-50 text-center">
          <p className="text-[10px] text-gray-400">Generated on {format(new Date(), "dd MMM yyyy, hh:mm a")} • This is a computer-generated document</p>
        </div>
      </div>
    </div>
  );
};
