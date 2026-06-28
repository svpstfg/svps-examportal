import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Trash2, Link } from "lucide-react";
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

interface QuestionPaperUploadProps {
  classes: Class[];
  userId: string;
}

export const QuestionPaperUpload = ({ classes, userId }: QuestionPaperUploadProps) => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    const { data, error } = await supabase
      .from("question_papers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPapers(data as QuestionPaper[]);
    }
    setLoading(false);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedClassId || !title.trim()) {
      toast.error("Please select a class, enter a title, and choose a PDF file.");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20MB.");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${selectedClassId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("question-papers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("question_papers")
        .insert({
          class_id: selectedClassId,
          title: title.trim(),
          file_path: filePath,
          file_name: file.name,
          uploaded_by: userId,
        });

      if (insertError) throw insertError;

      toast.success("Question paper uploaded successfully!");
      setTitle("");
      setSelectedClassId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadPapers();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload question paper.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (paper: QuestionPaper) => {
    try {
      await supabase.storage.from("question-papers").remove([paper.file_path]);
      const { error } = await supabase.from("question_papers").delete().eq("id", paper.id);
      if (error) throw error;
      setPapers((prev) => prev.filter((p) => p.id !== paper.id));
      toast.success("Question paper deleted.");
    } catch {
      toast.error("Failed to delete question paper.");
    }
  };

  const getClassName = (classId: string) =>
    classes.find((c) => c.id === classId)?.name || "Unknown";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Previous Year Question Paper</span>
          </CardTitle>
          <CardDescription>Upload PDF question papers for your students to download</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g., Math Final 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>PDF File</Label>
            <Input ref={fileInputRef} type="file" accept=".pdf" />
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Uploaded Question Papers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : papers.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No question papers uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {papers.map((paper) => (
                <div key={paper.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">{paper.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {getClassName(paper.class_id)} • {paper.file_name} • {format(new Date(paper.created_at), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => {
                      const link = `${window.location.origin}/paper/${paper.id}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Shareable link copied!");
                    }}>
                      <Link className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(paper)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
