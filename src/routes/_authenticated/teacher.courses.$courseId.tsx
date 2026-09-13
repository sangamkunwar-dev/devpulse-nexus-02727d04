import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, FileUp, Plus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher/courses/$courseId")({ component: TeacherCourseManager });
type Course = { id: string; title: string; description: string; published: boolean };
type Lesson = { id: string; title: string; content: string | null; position: number };
type Enrollment = { id: string; status: "pending" | "accepted" | "rejected"; student?: { display_name: string | null; username: string | null } | null };

function TeacherCourseManager() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: courseData }, { data: lessonData }, { data: enrollmentData }] = await Promise.all([
      (supabase as any).from("courses").select("id,title,description,published").eq("id", courseId).maybeSingle(),
      (supabase as any).from("course_lessons").select("id,title,content,position").eq("course_id", courseId).order("position", { ascending: true }),
      (supabase as any).from("course_enrollments").select("id,status,student:profiles!course_enrollments_student_id_fkey(display_name,username)").eq("course_id", courseId).order("created_at", { ascending: false }),
    ]);
    setCourse(courseData as Course | null); setLessons((lessonData ?? []) as Lesson[]); setStudents((enrollmentData ?? []) as Enrollment[]);
  };
  useEffect(() => { void load(); }, [courseId]);
  const updateEnrollment = async (id: string, status: "accepted" | "rejected") => { const { error } = await (supabase as any).from("course_enrollments").update({ status }).eq("id", id); if (error) toast.error("Could not update request."); else { setStudents((items) => items.map((item) => item.id === id ? { ...item, status } : item)); toast.success(status === "accepted" ? "Student accepted." : "Request declined."); } };
  const addLesson = async (event: React.FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("Add a lesson title."); setSaving(true); const { data, error } = await (supabase as any).from("course_lessons").insert({ course_id: courseId, title: title.trim(), content: content.trim(), position: lessons.length + 1 }).select("id,title,content,position").single(); setSaving(false); if (error) return toast.error("Could not add lesson."); setLessons((items) => [...items, data as Lesson]); setTitle(""); setContent(""); toast.success("Lesson added."); };
  if (!course) return <main className="min-h-screen bg-background p-6">Loading course manager…</main>;
  return <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl"><Link to="/teacher" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Teacher Studio</Link><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Course manager</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-5xl">{course.title}</h1><p className="mt-3 max-w-2xl text-muted-foreground">Manage your lessons and review every student request for this course.</p></header><div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><section className="bento-card p-5 sm:p-7"><div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curriculum</p><h2 className="mt-1 font-display text-2xl font-semibold">{lessons.length} lessons</h2></div><Plus className="text-primary" /></div><form onSubmit={addLesson} className="mb-7 rounded-2xl border border-primary/20 bg-primary/5 p-4"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Lesson ${lessons.length + 1} title`} /><Textarea className="mt-3" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Explain what students will learn…" /><div className="mt-3 flex flex-wrap gap-2"><Button disabled={saving}>{saving ? "Adding…" : "Add lesson"}</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><FileUp className="size-4" /> Add resource<input type="file" className="sr-only" /></label></div></form><div className="space-y-3">{lessons.length ? lessons.map((lesson, index) => <article key={lesson.id} className="flex gap-4 rounded-xl border border-border p-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><div><h3 className="font-semibold">{lesson.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{lesson.content || "No lesson notes yet."}</p></div></article>) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Add your first lesson above.</p>}</div></section><aside className="bento-card h-fit p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><UserRound className="text-primary" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Students</p><h2 className="font-display text-2xl font-semibold">{students.length} requests</h2></div></div><div className="space-y-3">{students.length ? students.map((student) => <div key={student.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{student.student?.display_name ?? student.student?.username ?? "Student"}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{student.status}</p></div>{student.status === "accepted" && <Check className="size-4 text-primary" />}</div>{student.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void updateEnrollment(student.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => void updateEnrollment(student.id, "rejected")}><X className="size-4" /> Decline</Button></div>}</div>) : <p className="text-sm text-muted-foreground">No students have requested this course yet.</p>}</div></aside></div></div></main>;
}
