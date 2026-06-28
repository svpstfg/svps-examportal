import { useEffect, useRef } from "react";
import { Test } from "@/types";
import { RichTextDisplay } from "./RichTextDisplay";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Props {
  test: Test;
  onDone: () => void;
}

/**
 * Renders a printable answer-key style layout off-screen and exports it as a PDF.
 * Mount this component with a test, it will auto-generate the PDF and call onDone.
 */
export const TestPaperPDF = ({ test, onDone }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  // console.log(test);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const node = ref.current;
      if (!node) return;
      try {
        await document.fonts.ready;
        // small delay so images/fonts settle
        await new Promise((r) => setTimeout(r, 100));

        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          allowTaint: true,
          windowWidth: node.scrollWidth,
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

        pdf.save(`${test.title.replace(/\s+/g, "_")}_QuestionPaper.pdf`);
      } finally {
        if (!cancelled) onDone();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: "1180px",
        background: "#fff",
        zIndex: -1,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <div ref={ref} className="bg-white text-black p-6" style={{ width: "1180px" }}>
        <div className="border-2 border-black p-4 mb-0 text-center">
           <h1 className="text-2xl font-bold uppercase tracking-wide">{test.title}</h1>
          {/* <h2 className="text-2xl font-bold uppercase tracking-wide">{test.class}</h2> */}
          <p className="text-xs text-gray-600 mt-1">
            Total Questions: {test.questions.length} • Duration: {test.duration} min
          </p>
        </div>

        <div className="border-x-2 border-b-2 border-black grid grid-cols-2 gap-0">
          {test.questions.map((q, index) => {
            return (
              <div key={q.id || index} className="p-3 border border-gray-200">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold bg-gray-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[16px] leading-snug">
                      <RichTextDisplay content={q.question} />
                    </div>
                  </div>
                </div>

                {q.questionImage && (
                  <img src={q.questionImage} alt="Question" className="max-h-32 rounded mb-2 ml-8" />
                )}

                <div className="ml-8 space-y-1">
                  {q.options.map((option, optIndex) => {
                    return (
                      <div key={optIndex} className="flex items-center gap-1.5 py-1 px-2 rounded text-[16px] border border-gray-200">
                        <span className="font-bold text-[10px] w-4">({String.fromCharCode(65 + optIndex)})</span>
                        <span className="flex-1">
                          <RichTextDisplay content={option} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
