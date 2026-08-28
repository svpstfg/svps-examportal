import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Link } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Class } from "@/types";

interface QuestionPaper {
  id: string;
  class_id: string;
  title: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

interface Props {
  enrolledClassIds: string[];
  selectedClassId: string;
  classes: Class[];
}

export const QuestionPaperDownload = ({ enrolledClassIds, selectedClassId, classes }: Props) => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (enrolledClassIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("question_papers")
        .select("*")
        .in("class_id", enrolledClassIds)
        .order("created_at", { ascending: false });

      if (!error && data) setPapers(data as QuestionPaper[]);
      setLoading(false);
    };
    load();
  }, [enrolledClassIds]);

  const filteredPapers = selectedClassId === "all"
    ? papers
    : papers.filter((p) => p.class_id === selectedClassId);

  const handleDownload = (paper: QuestionPaper) => {
    const { data } = supabase.storage
      .from("question-papers")
      .getPublicUrl(paper.file_path);
    window.open(data.publicUrl, "_blank");
  };

  const getClassName = (classId: string) =>
    classes.find((c) => c.id === classId)?.name || "Unknown";

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Previous Year Question Papers</span>
        </CardTitle>
        <CardDescription>
          {filteredPapers.length} paper(s) available for download
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredPapers.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No question papers available yet.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredPapers.map((paper) => (
              <div key={paper.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium">{paper.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {getClassName(paper.class_id)} • {format(new Date(paper.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => {
                    const link = `${window.location.origin}/paper/${paper.id}`;
                    navigator.clipboard.writeText(link);
                    toast.success("Shareable link copied!");
                  }}>
                    <Link className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(paper)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
