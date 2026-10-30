import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  FileText,
  FileUp,
  Github,
  GraduationCap,
  ListPlus,
  Plus,
  Settings2,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher")({ component: TeacherDashboard });

type Course = {
  id: string;
  title: string;
  description: string;
  level: string;
  published: boolean;
  is_free: boolean;
  price: number;
  repo_url?: string | null;
};

type Enrollment = { id: string; student_id: string; created_at: string };
type Panel = "requests" | "lessons" | "details";

function TeacherDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("details");
  const [requests, setRequests] = useState<Enrollment[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonBusy, setLessonBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const loadCourses = async () => {
    const { data, error } = await (supabase as any)
      .from("courses")
      .select("id,title,description,level,published,is_free,price,repo_url")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load courses.");
    else setCourses((data ?? []) as Course[]);
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  const createCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("Add a course name.");
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("courses").insert({
      teacher_id: userData.user?.id,
      title: title.trim(),
      description: description.trim(),
      repo_url: repoUrl.trim() || null,
      is_free: isFree,
      price: isFree ? 0 : Math.max(0, Number(price) || 0),
    });
    setBusy(false);
    if (error) return toast.error("Could not create course. Check the teaching database migration.");
    setTitle("");
    setDescription("");
    setRepoUrl("");
    setPrice("0");
    setIsFree(true);
    setShowCreate(false);
    await loadCourses();
    toast.success("Course created.");
  };

  const openManager = async (course: Course, panel: Panel = "details") => {
    await navigate({
      to: "/teacher/manage/$courseId",
      params: { courseId: course.id },
      search: { panel },
    });
    if (panel !== "requests") return;
    const { data, error } = await (supabase as any)
      .from("course_enrollments")
      .select("id,student_id,created_at")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Student requests are unavailable until teacher access is enabled.");
    else setRequests((data ?? []) as Enrollment[]);
  };

  const removeRequest = async (request: Enrollment) => {
    const { error } = await (supabase as any).from("course_enrollments").delete().eq("id", request.id);
    if (error) return toast.error("Could not remove this request.");
    setRequests((items) => items.filter((item) => item.id !== request.id));
    toast.success("Student request removed.");
  };

  const addLesson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse || !lessonTitle.trim()) return toast.error("Add a lesson title.");
    setLessonBusy(true);
    const { error } = await (supabase as any).from("course_lessons").insert({
      course_id: selectedCourse.id,
      title: lessonTitle.trim(),
      content: lessonContent.trim(),
      position: 1,
    });
    setLessonBusy(false);
    if (error) return toast.error("Could not add lesson. Check the course database migration.");
    setLessonTitle("");
    setLessonContent("");
    toast.success("Lesson added.");
  };

  const uploadLessonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCourse) return;
    setUploadBusy(true);
    const { data } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", selectedCourse.id);
    const response = await fetch("/api/teacher/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: formData,
    });
    const result = (await response.json()) as { pathname?: string; filename?: string; contentType?: string; error?: string };
    setUploadBusy(false);
    if (!response.ok || !result.pathname) return toast.error(result.error ?? "Upload failed.");
    const { error } = await (supabase as any).from("course_lessons").insert({
      course_id: selectedCourse.id,
      title: result.filename ?? file.name,
      content: "Uploaded lesson resource",
      position: 1,
      asset_path: result.pathname,
      asset_name: result.filename ?? file.name,
      asset_content_type: result.contentType ?? file.type,
    });
    if (error) return toast.error("File uploaded, but lesson could not be saved.");
    toast.success("Lesson resource added.");
  };

  const togglePublished = async (course: Course) => {
    const { error } = await (supabase as any).from("courses").update({ published: !course.published }).eq("id", course.id);
    if (error) toast.error("Could not update course.");
    else {
      const updated = { ...course, published: !course.published };
      setCourses((items) => items.map((item) => (item.id === course.id ? updated : item)));
      setSelectedCourse((item) => (item?.id === course.id ? updated : item));
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-primary">TEACHER STUDIO</p>
            <h1 className="font-display text-4xl font-semibold">Teach what you know.</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Create courses, manage your students, and publish lessons from one place.</p>
          </div>
          <Link to="/dashboard"><Button variant="outline">Back to app</Button></Link>
        </div>

        {showCreate ? (
          <section className="bento-card mb-8 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="font-display text-xl font-semibold">Add course</h2><p className="text-sm text-muted-foreground">Give your new course a clear name and description.</p></div>
              <Button variant="ghost" size="icon" aria-label="Close add course" onClick={() => setShowCreate(false)}><X /></Button>
            </div>
            <form onSubmit={createCourse} className="grid gap-4 md:grid-cols-2">
              <div><Label htmlFor="course-title">Name of course</Label><Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="JavaScript foundations" /></div>
              <div><Label htmlFor="course-repository">GitHub URL</Label><div className="mt-1 flex items-center gap-2"><Github className="size-4 text-muted-foreground" /><Input id="course-repository" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/project" type="url" /></div></div>
              <div className="md:col-span-2"><Label htmlFor="course-description">Description</Label><Textarea id="course-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students build?" /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2"><div><Label htmlFor="course-paid">Paid course</Label><p className="text-xs text-muted-foreground">Turn this off to offer it free.</p></div><input id="course-paid" type="checkbox" checked={!isFree} onChange={(e) => setIsFree(!e.target.checked)} className="size-4 accent-primary" /></div>
              {!isFree && <div><Label htmlFor="course-price">Price</Label><Input id="course-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.00" /></div>}
              <div className="flex gap-2 md:col-span-2"><Button disabled={busy}>{busy ? "Creating…" : "Create course"}</Button><Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button></div>
            </form>
          </section>
        ) : (
          <div className="mb-8 flex justify-end"><Button onClick={() => setShowCreate(true)}><Plus data-icon="inline-start" />Add course</Button></div>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-2xl font-semibold">Your courses</h2><p className="text-sm text-muted-foreground">Choose a course to manage its students, lessons, and details.</p></div><div className="flex gap-2 text-sm text-muted-foreground"><GraduationCap /> Teaching library</div></div>
          {courses.length === 0 ? <div className="bento-card flex flex-col items-center gap-3 p-12 text-center"><BookOpen className="text-primary" /><p className="font-medium">No courses yet.</p><p className="text-sm text-muted-foreground">Click Add course to create your first one.</p></div> : <div className="grid gap-4 md:grid-cols-2">{courses.map((course) => <article key={course.id} className="bento-card flex flex-col gap-5 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{course.title}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description || "No description yet"}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs">{course.published ? "Published" : "Draft"}</span></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void openManager(course)}><Settings2 data-icon="inline-start" />Manage course</Button><Button variant="outline" size="sm" onClick={() => void togglePublished(course)}>{course.published ? "Unpublish" : "Publish"}</Button></div></article>)}</div>}
        </section>

        {selectedCourse && <section id="course-manager" className="bento-card mt-8 scroll-mt-6 p-6"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm text-primary">COURSE MANAGEMENT</p><h2 className="mt-1 font-display text-2xl font-semibold">{selectedCourse.title}</h2><p className="mt-1 text-sm text-muted-foreground">Manage this course from the sidebar.</p></div><Button variant="ghost" size="icon" aria-label="Close course manager" onClick={() => setSelectedCourse(null)}><X /></Button></div><div className="grid gap-6 md:grid-cols-[220px_1fr]"><aside className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Course management navigation"><Button className="justify-start whitespace-nowrap" variant={activePanel === "details" ? "secondary" : "outline"} onClick={() => setActivePanel("details")}><FileText data-icon="inline-start" />Course details</Button><Button className="justify-start whitespace-nowrap" variant={activePanel === "requests" ? "secondary" : "outline"} onClick={() => void openManager(selectedCourse, "requests")}><Users data-icon="inline-start" />Students requested</Button><Button className="justify-start whitespace-nowrap" variant={activePanel === "lessons" ? "secondary" : "outline"} onClick={() => setActivePanel("lessons")}><ListPlus data-icon="inline-start" />Lesson</Button></aside><div className="min-w-0">
          {activePanel === "requests" && <div className="mt-6"><div className="mb-4 flex items-center gap-3"><Users className="text-primary" /><div><h3 className="font-semibold">Student requests</h3><p className="text-sm text-muted-foreground">{requests.length} student{requests.length === 1 ? "" : "s"} requested access.</p></div></div>{requests.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No student requests yet.</p> : <div className="flex flex-col gap-2">{requests.map((request) => <div key={request.id} className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="font-medium">Student request</p><p className="text-xs text-muted-foreground">{request.student_id}</p></div><Button variant="ghost" size="icon" aria-label="Remove student request" onClick={() => void removeRequest(request)}><Trash2 /></Button></div>)}</div>}</div>}
          {activePanel === "lessons" && <form onSubmit={addLesson} className="mt-6 flex flex-col gap-3"><div className="flex items-center gap-3"><Video className="text-primary" /><div><h3 className="font-semibold">Add a lesson</h3><p className="text-sm text-muted-foreground">Add text, notes, or upload a lesson resource.</p></div></div><Input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="Lesson title" /><Textarea value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} placeholder="Lesson notes or instructions" /><div className="flex flex-wrap gap-2"><Button disabled={lessonBusy}>{lessonBusy ? "Saving…" : "Add lesson"}</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><FileUp />{uploadBusy ? "Uploading…" : "Upload resource"}<input type="file" accept="video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx,.zip" className="sr-only" onChange={(event) => void uploadLessonFile(event)} /></label></div></form>}
          {activePanel === "details" && <div className="mt-6 grid gap-4 rounded-lg border border-border p-5 md:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p><p className="mt-1 font-medium">{selectedCourse.title}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Access</p><p className="mt-1 font-medium">{selectedCourse.is_free ? "Free" : `$${Number(selectedCourse.price ?? 0).toFixed(2)}`}</p></div><div className="md:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1 text-sm text-muted-foreground">{selectedCourse.description || "No description yet"}</p></div><div className="md:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">GitHub URL</p>{selectedCourse.repo_url ? <a className="mt-1 inline-flex items-center gap-2 text-sm text-primary hover:underline" href={selectedCourse.repo_url} target="_blank" rel="noreferrer"><Github />{selectedCourse.repo_url}</a> : <p className="mt-1 text-sm text-muted-foreground">No GitHub URL added.</p>}</div><div className="flex items-center gap-2 text-sm text-emerald-500 md:col-span-2"><Check />Details saved with this course.</div></div>}
          </div></div></section>}
      </div>
    </main>
  );
}
