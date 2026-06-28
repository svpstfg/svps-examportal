import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";

const PaperView = () => {
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) { setError(true); setLoading(false); return; }
      const { data, error: err } = await supabase
        .from("question_papers")
        .select("*")
        .eq("id", id)
        .single();

      if (err || !data) {
        setError(true);
      } else {
        setPaper(data);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDownload = () => {
    if (!paper) return;
    const { data } = supabase.storage
      .from("question-papers")
      .getPublicUrl(paper.file_path);
    window.open(data.publicUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Paper Not Found</h2>
            <p className="text-muted-foreground">This question paper doesn't exist or you don't have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <FileText className="h-12 w-12 mx-auto text-destructive mb-2" />
          <CardTitle>{paper.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{paper.file_name}</p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={handleDownload} size="lg">
            <Download className="h-5 w-5 mr-2" />
            Download PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaperView;
