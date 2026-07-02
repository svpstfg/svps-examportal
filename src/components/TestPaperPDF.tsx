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
<div className="border-2 border-gray-900 rounded-xl overflow-hidden shadow-lg mb-6">

  {/* Top Gradient Bar */}
  <div className="h-2 bg-gradient-to-r from-blue-800 via-sky-500 to-blue-800"></div>

  <div className="bg-white px-8 py-6">

    {/* School Name */}
    <h1 className="text-4xl font-extrabold text-center uppercase tracking-widest text-gray-900">
      SKYVIEW PUBLIC SCHOOL
    </h1>

    {/* Decorative Line */}
    <div className="flex items-center justify-center mt-3 mb-5">
      <div className="h-[2px] w-24 bg-blue-700"></div>
      <div className="mx-3 w-3 h-3 rounded-full bg-blue-700"></div>
      <div className="h-[2px] w-24 bg-blue-700"></div>
    </div>

    {/* Exam Title */}
    <h2 className="text-3xl font-bold text-center uppercase text-blue-800 tracking-wide">
      {test.title}
    </h2>

    {/* Subject & Class */}
    <div className="grid grid-cols-2 gap-4 mt-6 text-lg">
      <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
        <span className="font-semibold text-gray-700">Subject :</span>
        <span className="ml-2 font-bold text-blue-700 uppercase">
          {subjectName || "____________"}
        </span>
      </div>

      <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
        <span className="font-semibold text-gray-700">Class :</span>
        <span className="ml-2 font-bold text-blue-700 uppercase">
          {className || "____________"}
        </span>
      </div>
    </div>

    {/* Bottom Info */}
    <div className="mt-6 border-t pt-4 flex justify-between items-center text-gray-700 font-medium">

      <div>
        <span className="font-semibold">Total Questions :</span>{" "}
        {test.questions.length}
      </div>

      <div>
        <span className="font-semibold">Duration :</span>{" "}
        {test.duration} Minutes
      </div>

      <div>
        <span className="font-semibold">Full Marks :</span>{" "}
        {test.totalMarks || "____"}
      </div>

    </div>

  </div>

  {/* Bottom Accent */}
  <div className="h-2 bg-gradient-to-r from-blue-800 via-sky-500 to-blue-800"></div>

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
