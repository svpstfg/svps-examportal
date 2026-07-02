import { useEffect, useRef } from "react";
import { Test } from "@/types";
import { RichTextDisplay } from "./RichTextDisplay";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Props {
  test: Test;
  onDone: () => void;
  subjectName?: string;
  className?: string;
  showOptions?: boolean;
}

/**
 * Renders a printable answer-key style layout off-screen and exports it as a PDF.
 * Mount this component with a test, it will auto-generate the PDF and call onDone.
 */
export const TestPaperPDF = ({
  test,
  onDone,
  subjectName,
  className,
  showOptions = true,
}: Props) => {
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
        {/* <div className="border-2 border-black p-5 mb-0 text-center">
            <h1 className="text-3xl font-bold uppercase tracking-wide mt-2">SKYVIEW PUBLIC SCHOOL</h1>
          {subjectName && (
            <h3 className="text-xl font-semibold uppercase tracking-wide text-gray-800">
              Subject: {subjectName}
            </h3>
          )}
          {className && (
            <h3 className="text-lg font-medium tracking-wide text-gray-700 mt-1">
              Class: {className}
            </h3>
          )}
          <h4 className="text-3xl font-bold uppercase tracking-wide mt-2">{test.title}</h4>
          <h5 className="text-sm text-gray-600 mt-2">
            Total Questions: {test.questions.length} • Duration: {test.duration} min
          </h5>
        </div> */}

        <div className="border-2 border-gray-900 rounded-xl overflow-hidden shadow-lg mb-6 bg-white">

  {/* Top Gradient */}
  <div className="h-2 bg-gradient-to-r from-blue-700 via-sky-500 to-blue-700"></div>

  <div className="px-8 py-8 text-center">

    {/* School Name */}
    <h1 className="text-4xl font-extrabold uppercase tracking-wider text-gray-900">
      SKYVIEW{" "}
      <span className="underline decoration-blue-600 decoration-4 underline-offset-8">
        PUBLIC
      </span>{" "}
      SCHOOL
    </h1>

    {/* Subject & Class */}
    <div className="flex justify-center flex-wrap gap-4 mt-8 mb-6">

      {subjectName && (
        <div className="px-5 py-2 rounded-full bg-blue-50 border border-blue-300 text-blue-700 font-semibold shadow-sm">
          📘 Subject : <span className="font-bold">{subjectName}</span>
        </div>
      )}

      {className && (
        <div className="px-5 py-2 rounded-full bg-green-50 border border-green-300 text-green-700 font-semibold shadow-sm">
          🎓 Class : <span className="font-bold">{className}</span>
        </div>
      )}

    </div>

    {/* Exam Title */}
    {test?.title?.trim() && (
      <div className="inline-block bg-blue-700 text-white px-10 py-3 rounded-xl shadow-lg mb-8">
        <h2 className="text-3xl font-bold uppercase tracking-widest">
          {test.title}
        </h2>
      </div>
    )}

    {/* Information Cards */}
    <div className="flex justify-center gap-6 flex-wrap">

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-8 py-4 shadow-sm min-w-[150px]">
        <div className="text-gray-500 text-sm font-medium">
          📝 Questions
        </div>
        <div className="text-3xl font-bold text-blue-700 mt-1">
          {test.questions.length}
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-8 py-4 shadow-sm min-w-[150px]">
        <div className="text-gray-500 text-sm font-medium">
          ⏱ Duration
        </div>
        <div className="text-3xl font-bold text-red-600 mt-1">
          {test.duration} Min
        </div>
      </div>

    </div>

  </div>

</div>

        <div className="border-x-2 border-b-2 border-black grid grid-cols-2 gap-0">
          {test.questions.map((q, index) => {
            return (
              <div key={q.id || index} className="p-3 border border-gray-200">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[13px] font-bold bg-gray-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[20px] leading-snug">
                      <RichTextDisplay content={q.question} />
                    </div>
                  </div>
                </div>

                {q.questionImage && (
                  <img src={q.questionImage} alt="Question" className="max-h-40 rounded mb-2 ml-9" />
                )}

                {showOptions && (
                  <div className="ml-9 space-y-1">
                    {q.options.map((option, optIndex) => {
                      return (
                        <div
                          key={optIndex}
                          className="flex items-center gap-2 py-1.5 px-2 rounded text-[19px] border border-gray-200"
                        >
                          <span className="font-bold text-[15px] w-5">
                            ({String.fromCharCode(65 + optIndex)})
                          </span>
                          <span className="flex-1">
                            <RichTextDisplay content={option} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
