import { useEffect, useRef, useState } from "react";
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
  aiReportEnabled?: boolean;
}

export const AnswerSheetView = ({ attempt, test, studentName, onBack, subject, className, aiReportEnabled = true }: AnswerSheetViewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSavedReport = async () => {
      setAiReport("");
      const { data, error } = await supabase
        .from("student_analyses")
        .select("report")
        .eq("test_id", test.id)
        .eq("student_id", attempt.studentId)
        .maybeSingle();
      if (active && !error && data?.report) setAiReport(data.report);
    };
    loadSavedReport();
    return () => { active = false; };
  }, [attempt.studentId, test.id]);

  const correctCount = attempt.answers.reduce((total, answer, index) => {
    return total + (answer === test.questions[index]?.correctAnswer ? 1 : 0);
  }, 0);

  const questionTimes = (attempt.questionTimes || []).map(normalizeQuestionTime);
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  const attemptedCount = test.questions.filter((_, index) => isAnswered(attempt.answers[index])).length;
  const wrongQuestionNumbers = test.questions
    .map((question, index) => (!isAnswered(attempt.answers[index]) || !isAnswerCorrect(attempt.answers[index], question.correctAnswer) ? index + 1 : null))
    .filter((index): index is number => index !== null);
  const fastCorrectQuestionNumbers = test.questions
    .map((question, index) => (
      isAnswerCorrect(attempt.answers[index], question.correctAnswer) && questionTimes[index] > 0 && questionTimes[index] <= 45 ? index + 1 : null
    ))
    .filter((index): index is number => index !== null);
  const accuracy = attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const attemptRate = test.questions.length ? Math.round((attemptedCount / test.questions.length) * 100) : 0;
  const avgTime = attemptedCount ? Math.round(attempt.timeSpent / attemptedCount) : 0;
  const plannedTimePerQuestion = test.questions.length ? Math.round((test.duration * 60) / test.questions.length) : 0;
  const confidence = accuracy >= 75 && attemptRate >= 80 ? "High" : accuracy >= 50 || attemptRate >= 70 ? "Growing" : "Build with practice";
  const timeManagement = avgTime <= plannedTimePerQuestion ? "On pace" : avgTime <= plannedTimePerQuestion * 1.2 ? "Needs pacing" : "Needs time practice";
  const speedScore = avgTime ? Math.max(0, Math.min(100, Math.round(((150 - avgTime) / 120) * 100))) : 0;
  const quickCorrectRate = correctCount ? Math.round((fastCorrectQuestionNumbers.length / correctCount) * 100) : 0;
  // One exam does not provide a score trend; the same 70 starting consistency
  // used by Talent Search is shown transparently as a provisional baseline.
  const currentExamTalentScore = Math.round(
    accuracy * 0.35 + attemptRate * 0.15 + speedScore * 0.15 + 70 * 0.15 + quickCorrectRate * 0.1,
  );
  const talentScoreRows = [
    ["Accuracy", accuracy, 35],
    ["Attempt rate", attemptRate, 15],
    ["Solving speed", speedScore, 15],
    ["Consistency baseline", 70, 15],
    ["Improvement trend", 0, 10],
    ["Quick, correct answers", quickCorrectRate, 10],
  ];
  const performanceRows = [
    ["Stronger response areas", fastCorrectQuestionNumbers.length ? `Quick, correct: Q${fastCorrectQuestionNumbers.slice(0, 5).join(", Q")}` : correctCount ? `${correctCount} correct answer${correctCount === 1 ? "" : "s"}` : "Keep building core concepts"],
    ["Weaker response areas", wrongQuestionNumbers.length ? `Review Q${wrongQuestionNumbers.slice(0, 5).join(", Q")}` : "No incorrect or skipped answers"],
    ["Fast thinking", fastCorrectQuestionNumbers.length ? `${fastCorrectQuestionNumbers.length} quick-correct answer${fastCorrectQuestionNumbers.length === 1 ? "" : "s"} (≤45 sec)` : "No quick-correct pattern yet"],
    ["Accuracy", `${accuracy}% of attempted questions correct`],
    ["Answer confidence", `${confidence} (${attemptRate}% attempted)`],
    ["Time management", `${timeManagement} — ${formatTime(avgTime)} per attempt; target ${formatTime(plannedTimePerQuestion)}`],
  ];
  const lessonPlanRows = Object.entries(test.questions.reduce<Record<string, { total: number; correct: number; time: number }>>((groups, question, index) => {
    const category = question.lessonPlanCategory?.trim();
    if (!category) return groups;
    const group = groups[category] || { total: 0, correct: 0, time: 0 };
    group.total += 1;
    group.time += questionTimes[index] || 0;
    if (isAnswerCorrect(attempt.answers[index], question.correctAnswer)) group.correct += 1;
    groups[category] = group;
    return groups;
  }, {})).map(([category, group]) => ({
    category,
    questions: group.total,
    correct: group.correct,
    accuracy: Math.round((group.correct / group.total) * 100),
    avgTime: Math.round(group.time / group.total),
  }));

  const handleDownloadPDF = async () => {
    const content = printRef.current;
    if (!content) return;

    setDownloading(true);
    try {
      await document.fonts.ready;

      const canvas = await html2canvas(content, {
        scale: Math.min(4, Math.max(3, (window.devicePixelRatio || 1) * 3)),
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
          testId: test.id,
          studentId: attempt.studentId,
        },
      });
      if (error) {
        const msg = (await error.context?.json?.())?.error;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setAiReport(data?.report || "No report generated.");
      toast.success(data?.cached ? "Saved AI report loaded" : "AI report ready");
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
          {aiReportEnabled && (
            <Button variant="secondary" onClick={runAiAnalysis} disabled={aiLoading || !!aiReport}>
              {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {aiLoading ? "Analysing..." : aiReport ? "Report Saved" : "AI Report"}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            🖨️ Print
          </Button>
          <Button onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {downloading ? "Generating PDF..." : "Download as PDF"}
          </Button>
        </div>
      </div>

      {/* Printable exam paper layout */}
      <div ref={printRef} className="bg-white text-black">
        <div className="border-2 border-black border-b-0 p-4">
          <h3 className="font-bold text-sm uppercase tracking-wide mb-2">Performance Report</h3>
          <p className="mb-3 text-[10px] text-gray-700">This report uses only this exam’s recorded answers and question times. It does not change your marks.</p>
          <table className="w-full border-collapse text-[10px] mb-3">
            <thead><tr><th className="border border-black p-1 text-left">Performance area</th><th className="border border-black p-1 text-left">Result</th></tr></thead>
            <tbody>{performanceRows.map(([area, result]) => <tr key={area}><td className="border border-black p-1 font-semibold">{area}</td><td className="border border-black p-1">{result}</td></tr>)}</tbody>
          </table>
          <div className="grid grid-cols-1 gap-1 text-[10px] leading-snug sm:grid-cols-2">
            <p><strong>Accuracy:</strong> correct answers ÷ attempted answers.</p>
            <p><strong>Fast thinking:</strong> a correct answer completed in 45 seconds or less.</p>
            <p><strong>Answer confidence:</strong> an exam indicator based on accuracy and questions attempted—not a measure of personality or IQ.</p>
            <p><strong>Time management:</strong> average time per attempted question compared with the planned time per question.</p>
          </div>
          {lessonPlanRows.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 font-bold text-[11px] uppercase tracking-wide">Lesson-plan Performance</h4>
              <table className="w-full border-collapse text-[10px]">
                <thead><tr><th className="border border-black p-1 text-left">Category</th><th className="border border-black p-1 text-right">Questions</th><th className="border border-black p-1 text-right">Correct</th><th className="border border-black p-1 text-right">Accuracy</th><th className="border border-black p-1 text-right">Avg. time</th></tr></thead>
                <tbody>{lessonPlanRows.map((row) => <tr key={row.category}><td className="border border-black p-1 font-semibold">{row.category}</td><td className="border border-black p-1 text-right">{row.questions}</td><td className="border border-black p-1 text-right">{row.correct}</td><td className="border border-black p-1 text-right">{row.accuracy}%</td><td className="border border-black p-1 text-right">{formatTime(row.avgTime)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <h4 className="mb-2 font-bold text-[11px] uppercase tracking-wide">Talent Score Calculation: {currentExamTalentScore}</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead><tr><th className="border border-black p-1 text-left">Factor</th><th className="border border-black p-1 text-left">Score × weight</th><th className="border border-black p-1 text-right">Contribution</th></tr></thead>
              <tbody>{talentScoreRows.map(([factor, value, weight]) => <tr key={String(factor)}><td className="border border-black p-1 font-semibold">{factor}</td><td className="border border-black p-1">{value} × {weight}%</td><td className="border border-black p-1 text-right">{(Number(value) * Number(weight) / 100).toFixed(1)}</td></tr>)}</tbody>
            </table>
            <p className="mt-2 text-[10px] text-gray-700">Formula: Accuracy × 35% + Attempt rate × 15% + Speed × 15% + Consistency × 15% + positive trend × 10% + quick-correct rate × 10%. This single-exam score is provisional: trend is 0 and consistency starts at 70 until more exams are completed. The multi-exam Talent Search score may differ.</p>
          </div>
        </div>
        {aiReport && (
          <div className="border-x-2 border-b-2 border-black p-4">
            <h3 className="font-bold text-sm uppercase tracking-wide mb-2">AI Guidance</h3>
            <table className="w-full border-collapse text-[10px] mb-3">
              <tbody><tr><td className="border border-black p-1 text-gray-700">Suggestions are generated from the factual performance report above. They are guidance for study, not a change to marks.</td></tr></tbody>
            </table>
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
              <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide mt-1">Score Obtained</p>
            </div>
            <div className="px-4">
              <div className="text-3xl font-bold">{correctCount}/{test.questions.length}</div>
              <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide mt-1">Correct Answers</p>
            </div>
            <div className="px-4">
              <div className="text-3xl font-bold">{formatTime(attempt.timeSpent)}</div>
              <p className="text-xs text-gray-700 font-semibold uppercase tracking-wide mt-1">Total Time Taken</p>
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
                  <p className="ml-7 mt-1 text-[9px] text-red-700 font-semibold italic">⚠ Not Answered</p>
                )}

                <div className="ml-7 mt-2 flex flex-wrap items-center gap-2 text-[9px]">
                  <div className="rounded bg-gray-900 px-2 py-1 text-white font-semibold flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    <span>Time to solve:</span> {formatTime(timeSpent)}
                  </div>
                  <div className={`rounded px-2 py-1 font-semibold ${!isCorrect || !answered ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>
                    <span className="font-bold">Remark:</span> {getQuestionRemark(isCorrect, timeSpent, answered)}
                  </div>
                </div>

                {question.explanation && (
                  <div className="ml-7 mt-2 border-l-2 border-blue-500 bg-blue-50 px-2 py-1 rounded-r">
                    <p className="font-bold text-[8px] text-blue-900 mb-0.5">EXPLANATION</p>
                    <RichTextDisplay content={question.explanation} className="text-gray-900 text-[9px] leading-snug" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-x-2 border-b-2 border-black px-4 py-3 bg-gray-100 text-center">
          <p className="text-[10px] text-gray-700 font-medium">Generated on {format(new Date(), "dd MMM yyyy, hh:mm a")} • This is a computer-generated document</p>
        </div>
      </div>
    </div>
  );
};
