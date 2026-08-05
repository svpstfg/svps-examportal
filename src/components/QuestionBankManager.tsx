import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { Library, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Question } from "@/types";
import { toast } from "sonner";

export interface BankRow {
  id: string;
  title: string | null;
  tags: string[];
  question: Question;
  created_at: string;
}

interface Props {
  /** When provided, each saved question shows an "Insert" action. */
  onInsert?: (question: Question) => void;
  compact?: boolean;
}

export const QuestionBankManager = ({ onInsert, compact }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<BankRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("question_bank")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load question bank");
    } else {
      setRows((data || []) as unknown as BankRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const text = `${r.title || ""} ${r.tags.join(" ")} ${r.question?.question || ""}`
        .replace(/<[^>]+>/g, " ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [rows, search]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Removed from bank");
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" /> Question Bank
          </h2>
          <p className="text-sm text-muted-foreground">
            Questions you saved from the test builder. Reuse them in any test.
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search saved questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No saved questions</CardTitle>
            <CardDescription>
              Use "Save to Bank" on any question in the test builder to reuse it later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {filtered.map((r) => (
            <Card key={r.id} className="border-l-4 border-l-primary">
              <CardContent className="pt-4 flex gap-4 justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <RichTextDisplay content={r.question?.question || ""} className="font-medium" as="div" />
                  <div className="flex flex-wrap gap-1">
                    {(r.question?.options || []).map((o, i) => (
                      <Badge
                        key={i}
                        variant={Number(r.question?.correctAnswer) === i ? "default" : "outline"}
                        className="max-w-[220px] truncate"
                      >
                        {String.fromCharCode(65 + i)}. {String(o).replace(/<[^>]+>/g, "")}
                      </Badge>
                    ))}
                  </div>
                  {r.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {onInsert && (
                    <Button size="sm" onClick={() => onInsert(r.question)}>
                      <Plus className="h-4 w-4 mr-1" /> Insert
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/** Save a single question into the teacher's bank. */
export async function saveQuestionToBank(teacherId: string, question: Question, tags: string[] = []) {
  const { error } = await supabase.from("question_bank").insert({
    teacher_id: teacherId,
    question: question as unknown as Record<string, unknown>,
    title: String(question.question || "").replace(/<[^>]+>/g, "").slice(0, 120),
    tags,
  } as never);
  if (error) throw error;
}
