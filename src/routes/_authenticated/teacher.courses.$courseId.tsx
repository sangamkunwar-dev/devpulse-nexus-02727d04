import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, FileUp, Pencil, Plus, Save, Trash2, UserRound, X } from "lucide-react";
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
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [courseSaving, setCourseSaving] = useState(false);

  const load = async () => {
    const [{ data: courseData }, { data: lessonData }, { data: enrollmentData }] = await Promise.all([
      (supabase as any).from("courses").select("id,title,description,published").eq("id", courseId).maybeSingle(),
      (supabase as any).from("course_lessons").select("id,title,content,position").eq("course_id", courseId).order("position", { ascending: true }),
      (supabase as any).from("course_enrollments").select("id,status,student:profiles!course_enrollments_student_id_fkey(display_name,username)").eq("course_id", courseId).order("created_at", { ascending: false }),
    ]);
    setCourse(courseData as Course | null); setLessons((lessonData ?? []) as Lesson[]); setStudents((enrollmentData ?? []) as Enrollment[]);
  };
  useEffect(() => { void load(); }, [courseId]);

  const saveCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!course || !course.title.trim()) return toast.error("Add a course title.");
    setCourseSaving(true);
    const { error } = await (supabase as any).from("courses").update({ title: course.title.trim(), description: course.description.trim() }).eq("id", course.id);
    setCourseSaving(false);
    if (error) return toast.error("Could not update course.");
    toast.success("Course details saved.");
  };
  const deleteCourse = async () => {
    if (!course || !window.confirm(`Delete ${course.title}? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("courses").delete().eq("id", course.id);
    if (error) return toast.error("Could not delete course.");
    toast.success("Course deleted.");
    window.location.assign("/teacher");
  };
  const updateEnrollment = async (id: string, status: "accepted" | "rejected") => { const { error } = await (supabase as any).from("course_enrollments").update({ status }).eq("id", id); if (error) toast.error("Could not update request."); else { setStudents((items) => items.map((item) => item.id === id ? { ...item, status } : item)); toast.success(status === "accepted" ? "Student accepted." : "Request declined."); } };
  const addLesson = async (event: React.FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("Add a lesson title."); setSaving(true); const { data, error } = await (supabase as any).from("course_lessons").insert({ course_id: courseId, title: title.trim(), content: content.trim(), position: lessons.length + 1 }).select("id,title,content,position").single(); setSaving(false); if (error) return toast.error("Could not add lesson."); setLessons((items) => [...items, data as Lesson]); setTitle(""); setContent(""); toast.success("Lesson added."); };
  const saveLesson = async (lesson: Lesson) => { const { error } = await (supabase as any).from("course_lessons").update({ title: lesson.title.trim(), content: lesson.content?.trim() ?? "" }).eq("id", lesson.id); if (error) return toast.error("Could not update lesson."); setEditingLesson(null); toast.success("Lesson updated."); };
  const deleteLesson = async (lesson: Lesson) => { if (!window.confirm(`Delete ${lesson.title}?`)) return; const { error } = await (supabase as any).from("course_lessons").delete().eq("id", lesson.id); if (error) return toast.error("Could not delete lesson."); setLessons((items) => items.filter((item) => item.id !== lesson.id)); toast.success("Lesson deleted."); };

  if (!course) return <main className="min-h-screen bg-background p-6">Loading course manager…</main>;
  return <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl"><Link to="/teacher" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Teacher Studio</Link><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Course manager</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-5xl">{course.title}</h1><p className="mt-3 max-w-2xl text-muted-foreground">Edit your course, manage lessons, and review student requests.</p></header><div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><section className="space-y-6"><form onSubmit={saveCourse} className="bento-card space-y-4 p-5 sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Course details</p><h2 className="mt-1 font-display text-2xl font-semibold">Edit course</h2></div><Input value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} placeholder="Course title" /><Textarea value={course.description} onChange={(event) => setCourse({ ...course, description: event.target.value })} placeholder="Course description" /><div className="flex flex-wrap gap-2"><Button disabled={courseSaving}><Save data-icon="inline-start" />{courseSaving ? "Saving…" : "Save changes"}</Button><Button type="button" variant="destructive" onClick={() => void deleteCourse()}><Trash2 data-icon="inline-start" /> Delete course</Button></div></form><section className="bento-card p-5 sm:p-7"><div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curriculum</p><h2 className="mt-1 font-display text-2xl font-semibold">{lessons.length} lessons</h2></div><Plus className="text-primary" /></div><form onSubmit={addLesson} className="mb-7 rounded-2xl border border-primary/20 bg-primary/5 p-4"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Lesson ${lessons.length + 1} title`} /><Textarea className="mt-3" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Explain what students will learn…" /><div className="mt-3 flex flex-wrap gap-2"><Button disabled={saving}>{saving ? "Adding…" : "Add lesson"}</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><FileUp className="size-4" /> Add resource<input type="file" className="sr-only" /></label></div></form><div className="space-y-3">{lessons.length ? lessons.map((lesson, index) => <article key={lesson.id} className="rounded-xl border border-border p-4">{editingLesson === lesson.id ? <div className="space-y-3"><Input value={lesson.title} onChange={(event) => setLessons((items) => items.map((item) => item.id === lesson.id ? { ...item, title: event.target.value } : item))} /><Textarea value={lesson.content ?? ""} onChange={(event) => setLessons((items) => items.map((item) => item.id === lesson.id ? { ...item, content: event.target.value } : item))} /><div className="flex gap-2"><Button type="button" size="sm" onClick={() => void saveLesson(lesson)}><Save data-icon="inline-start" /> Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingLesson(null)}>Cancel</Button></div></div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="font-medium">{lesson.title}</p><p className="mt-1 text-sm text-muted-foreground">{lesson.content || "Lesson content"}</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setEditingLesson(lesson.id)}><Pencil data-icon="inline-start" /> Edit</Button><Button type="button" size="sm" variant="ghost" onClick={() => void deleteLesson(lesson)} aria-label={`Delete ${lesson.title}`}><Trash2 className="size-4" /></Button></div></div>}</article>) : <p className="text-sm text-muted-foreground">No lessons yet. Add the first lesson above.</p>}</div></section></section><section className="bento-card h-fit p-5 sm:p-7"><div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Students</p><h2 className="mt-1 font-display text-2xl font-semibold">{students.length} enrolled</h2></div><UserRound className="text-primary" /></div><div className="space-y-3">{students.length ? students.map((student) => <div key={student.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{student.student?.display_name ?? student.student?.username ?? "Student"}</p><p className="text-xs capitalize text-muted-foreground">{student.status}</p></div>{student.status === "pending" && <div className="flex gap-1"><Button size="sm" onClick={() => void updateEnrollment(student.id, "accepted")} aria-label="Accept student"><Check className="size-4" /></Button><Button size="sm" variant="outline" onClick={() => void updateEnrollment(student.id, "rejected")} aria-label="Decline student"><X className="size-4" /></Button></div>}</div></div>) : <p className="text-sm text-muted-foreground">No students have joined this course yet.</p>}</div></section></div></div></main>;
}
