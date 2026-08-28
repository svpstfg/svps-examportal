import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV, parseStudentCSV } from "@/lib/csv";
import { Class } from "@/types";

interface Props {
  classes: Class[];
  onImported: () => void;
}

export const BulkStudentImport = ({ classes, onImported }: Props) => {
  const [classId, setClassId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    if (!classId) {
      toast.error("Select a class first");
      return;
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const { rows, errors } = parseStudentCSV(text);
      if (!rows.length) {
        toast.error("No valid rows found. CSV needs columns: name, email");
        return;
      }
      if (errors.length) errors.slice(0, 3).forEach((e) => toast.warning(e));

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          // upsert student record by email+class
          const { data: existing } = await supabase
            .from("students")
            .select("id")
            .eq("email", row.email)
            .eq("class_id", classId)
            .maybeSingle();

          let studentId: string;
          if (existing) {
            studentId = existing.id;
            skipped++;
          } else {
            const { data: created_, error } = await supabase
              .from("students")
              .insert({ name: row.name, email: row.email, class_id: classId })
              .select("id")
              .single();
            if (error) throw error;
            studentId = created_!.id;
            created++;
          }

          // ensure enrollment row exists
          const { data: existingEnroll } = await supabase
            .from("student_enrollments")
            .select("id")
            .eq("student_id", studentId)
            .eq("class_id", classId)
            .maybeSingle();
          if (!existingEnroll) {
            await supabase.from("student_enrollments").insert({ student_id: studentId, class_id: classId });
          }
        } catch (err) {
          console.error("Import row failed:", row.email, err);
          failed++;
        }
      }

      toast.success(`Imported ${created} new, ${skipped} already existed${failed ? `, ${failed} failed` : ""}`);
      onImported();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read CSV");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    downloadCSV("students_template.csv", [
      { name: "Aisha Khan", email: "aisha@example.com" },
      { name: "Rahul Roy", email: "rahul@example.com" },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Import Students (CSV)
        </CardTitle>
        <CardDescription>
          Drag a CSV with <code>name</code> and <code>email</code> columns. Existing students will be skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2 space-y-2">
            <Label>Target Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={downloadTemplate} type="button">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          } ${busy ? "opacity-60 pointer-events-none" : ""}`}
        >
          {busy ? (
            <>
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
              <p className="text-sm font-medium">Importing students…</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop CSV here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">UTF-8, max ~5,000 rows</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
