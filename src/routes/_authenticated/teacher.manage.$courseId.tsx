import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileUp, ListPlus, Save, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher/manage/$courseId")({ component: ManageCoursePage });

type Course = { id: string; title: string; description: string; is_free: boolean; price: number; repo_url?: string | null };
type Enrollment = { id: string; student_id: string; created_at: string };
type Panel = "details" | "requests" | "lessons";

function ManageCoursePage() {
  const { courseId } = Route.useParams();
  const searchPanel = new URLSearchParams(window.location.search).get("panel") as Panel | null;
  const [panel, setPanel] = useState<Panel>(searchPanel && ["details", "requests", "lessons"].includes(searchPanel) ? searchPanel : "details");
  const [course, setCourse] = useState<Course | null>(null);
  const [requests, setRequests] = useState<Enrollment[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any).from("courses").select("id,title,description,is_free,price,repo_url").eq("id", courseId).single();
      if (error) toast.error("Could not load this course."); else setCourse(data as Course);
    };
    void load();
  }, [courseId]);

  useEffect(() => {
    if (panel !== "requests") return;
    const loadRequests = async () => {
      const { data, error } = await (supabase as any).from("course_enrollments").select("id,student_id,created_at").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) toast.error("Student requests could not be loaded."); else setRequests((data ?? []) as Enrollment[]);
    };
    void loadRequests();
  }, [courseId, panel]);

  const choosePanel = (next: Panel) => {
    setPanel(next);
    window.history.replaceState(null, "", `/teacher/manage/${courseId}?panel=${next}`);
  };

  const removeRequest = async (requestId: string) => {
    const { error } = await (supabase as any).from("course_enrollments").delete().eq("id", requestId);
    if (error) return toast.error("Could not remove this request.");
    setRequests((items) => items.filter((item) => item.id !== requestId));
    toast.success("Student request removed.");
  };

  const addLesson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lessonTitle.trim()) return toast.error("Add a lesson title.");
    setBusy(true);
    let fileUrl: string | null = null;
    if (file) {
      const path = `lessons/${courseId}/${crypto.randomUUID()}-${file.name}`;
      const upload = await supabase.storage.from("course-files").upload(path, file);
      if (upload.error) { setBusy(false); return toast.error("File upload failed. Check the course-files bucket."); }
      fileUrl = supabase.storage.from("course-files").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await (supabase as any).from("course_lessons").insert({ course_id: courseId, title: lessonTitle.trim(), content: lessonContent.trim(), video_url: fileUrl });
    setBusy(false);
    if (error) return toast.error("Could not add this lesson.");
    setLessonTitle(""); setLessonContent(""); setFile(null); toast.success("Lesson added.");
  };

  if (!course) return <main className="page-shell"><p className="text-muted-foreground">Loading course manager…</p></main>;

  return <main className="page-shell px-4 py-6 sm:px-6 sm:py-10">
    <div className="mb-6 flex items-start gap-3 sm:mb-8 sm:items-center"><Link to="/teacher" aria-label="Back to teacher dashboard" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft /></Link><div className="min-w-0"><p className="text-xs font-semibold tracking-[0.2em] text-primary sm:text-sm">TEACHER STUDIO</p><h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">Manage course</h1><p className="truncate text-sm text-muted-foreground">{course.title}</p></div></div>
    <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:gap-6">
      <aside className="bento-card h-fit p-2 sm:p-3"><p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:block">Course tools</p><nav className="grid grid-cols-3 gap-1 lg:flex lg:flex-col" aria-label="Course management"><Button variant={panel === "details" ? "secondary" : "ghost"} className="h-auto justify-center px-2 py-3 text-xs sm:text-sm lg:justify-start" onClick={() => choosePanel("details")}><ListPlus data-icon="inline-start" />Course details</Button><Button variant={panel === "requests" ? "secondary" : "ghost"} className="h-auto justify-center px-2 py-3 text-xs sm:text-sm lg:justify-start" onClick={() => choosePanel("requests")}><Users data-icon="inline-start" />Students requested</Button><Button variant={panel === "lessons" ? "secondary" : "ghost"} className="h-auto justify-center px-2 py-3 text-xs sm:text-sm lg:justify-start" onClick={() => choosePanel("lessons")}><FileUp data-icon="inline-start" />Lesson</Button></nav></aside>
      <section className="bento-card p-4 sm:p-6">
        {panel === "details" && <div className="flex flex-col gap-6"><div><p className="text-sm text-primary">COURSE DETAILS</p><h2 className="mt-1 font-display text-2xl font-semibold">{course.title}</h2></div><div className="grid gap-3 sm:gap-4 md:grid-cols-2"><div className="rounded-xl bg-muted/30 p-3 sm:p-4"><Label>Name or title</Label><p className="mt-1 rounded-lg border border-border/60 p-3">{course.title}</p></div><div><Label>Access</Label><p className="mt-1 rounded-lg border border-border/60 p-3">{course.is_free ? "Free" : `Paid — $${Number(course.price).toFixed(2)}`}</p></div><div className="md:col-span-2"><Label>Description</Label><p className="mt-1 min-h-24 rounded-lg border border-border/60 p-3 text-muted-foreground">{course.description || "No description added."}</p></div><div className="md:col-span-2"><Label>GitHub URL</Label><p className="mt-1 rounded-lg border border-border/60 p-3 break-all">{course.repo_url || "No GitHub URL added."}</p></div></div></div>}
        {panel === "requests" && <div className="flex flex-col gap-5"><div><p className="text-sm text-primary">STUDENT REQUESTS</p><h2 className="mt-1 font-display text-2xl font-semibold">{requests.length} student{requests.length === 1 ? "" : "s"} requested to join</h2><p className="text-muted-foreground">Free-course requests and paid enrollments appear here.</p></div>{requests.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">No student requests yet.</p> : <div className="flex flex-col gap-3">{requests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Student {request.student_id.slice(0, 8)}</p><p className="text-sm text-muted-foreground">Requested {new Date(request.created_at).toLocaleDateString()}</p></div><Button variant="ghost" size="icon" aria-label="Remove student request" onClick={() => void removeRequest(request.id)}><Trash2 /></Button></div>)}</div>}</div>}
        {panel === "lessons" && <form onSubmit={(event) => void addLesson(event)} className="flex flex-col gap-5"><div><p className="text-sm text-primary">LESSON BUILDER</p><h2 className="mt-1 font-display text-2xl font-semibold">Add a lesson</h2><p className="text-muted-foreground">Add lesson text and optionally upload a file.</p></div><div><Label htmlFor="lesson-title">Lesson title</Label><Input id="lesson-title" value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="Introduction" /></div><div><Label htmlFor="lesson-content">Lesson content</Label><Textarea id="lesson-content" value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} placeholder="Write the lesson instructions..." /></div><div><Label htmlFor="lesson-file">Lesson file</Label><Input id="lesson-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div><Button type="submit" disabled={busy}>{busy ? "Adding..." : "Add lesson"}<Save data-icon="inline-end" /></Button></form>}
      </section>
    </div>
  </main>;
}
