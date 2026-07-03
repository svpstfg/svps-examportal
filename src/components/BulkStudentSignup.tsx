import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Download, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types";

interface Props {
  classes: Class[];
  onImported: () => void;
}

interface ParsedStudent {
  name: string;
  mobile: string;
  dob: string;
}

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keys.includes(norm)) {
      const v = row[k];
      return v == null ? "" : String(v).trim();
    }
  }
  return "";
};

export const BulkStudentSignup = ({ classes, onImported }: Props) => {
  const [classId, setClassId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState("svps.com");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("teacher_settings")
        .select("student_email_domain")
        .eq("teacher_id", uid)
        .maybeSingle();
      if (active && data?.student_email_domain) setDomain(data.student_email_domain);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    if (!classId) {
      toast.error("Select a class first");
      return;
    }
    const file = files[0];
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv")) {
      toast.error("Please upload a .xlsx, .xls or .csv file");
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      const students: ParsedStudent[] = [];
      for (const row of rows) {
        const name = pick(row, ["name", "studentname", "fullname"]);
        const mobile = pick(row, ["mobile", "mobilenumber", "phone", "phonenumber", "contact"]);
        const dob = pick(row, ["dob", "dateofbirth", "birthdate", "password"]);
        if (!mobile) continue;
        students.push({ name, mobile, dob });
      }

      if (!students.length) {
        toast.error("No valid rows found. Columns needed: name, mobile, dob");
        return;
      }

      const { data, error } = await supabase.functions.invoke("bulk-signup-students", {
        body: { classId, students },
      });

      if (error) {
        toast.error(error.message || "Bulk signup failed");
        return;
      }

      const { created = 0, skipped = 0, failed = 0 } = data ?? {};
      toast.success(
        `Signed up ${created} student${created === 1 ? "" : "s"}` +
          `${skipped ? `, ${skipped} already existed` : ""}` +
          `${failed ? `, ${failed} failed` : ""}`,
      );
      onImported();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { name: "Aisha Khan", mobile: "9876543210", dob: "2005-04-12" },
      { name: "Rahul Roy", mobile: "9812345678", dob: "2006-11-30" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_signup_template.xlsx");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-5 w-5" />
          Bulk Sign Up Students (Excel)
        </CardTitle>
        <CardDescription>
          Upload an Excel/CSV with <code>name</code>, <code>mobile</code> and{" "}
          <code>dob</code> columns. Each student gets a login account where the{" "}
          <strong>username is their mobile number</strong> and the{" "}
          <strong>password is their date of birth</strong>. They sign in with{" "}
          <code>&lt;mobile&gt;@{domain}</code>. Change this domain in{" "}
          <strong>User Management</strong>.
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
              <p className="text-sm font-medium">Signing up students…</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Drop Excel/CSV here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls or .csv</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
