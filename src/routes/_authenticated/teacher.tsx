import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileUp, Github, GraduationCap, Plus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
};
type Enrollment = { id: string; course_id: string; student_id: string; status: "pending" | "accepted" | "rejected"; student?: { display_name: string | null; username: string | null } | null };

function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const loadCourses = async () => {
    const { data, error } = await (supabase as any)
      .from("courses")
      .select("id,title,description,level,published,is_free,price")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load courses.");
    else {
      const nextCourses = (data ?? []) as Course[];
      setCourses(nextCourses);
      if (nextCourses.length) {
        const { data: rows } = await (supabase as any)
          .from("course_enrollments")
          .select("id,course_id,student_id,status,student:profiles!course_enrollments_student_id_fkey(display_name,username)")
          .in("course_id", nextCourses.map((course) => course.id))
          .order("created_at", { ascending: false });
        setEnrollments((rows ?? []) as Enrollment[]);
      }
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  const createCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("Add a course title.");
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setBusy(false);
      return toast.error("Your session has expired. Please sign in again.");
    }
    const { error } = await (supabase as any).from("courses").insert({
      teacher_id: userData.user.id,
      title: title.trim(),
      description: description.trim(),
      repo_url: repoUrl.trim() || null,
      is_free: isFree,
      price: isFree ? 0 : Math.max(0, Number(price) || 0),
    });
    setBusy(false);
    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      const needsMigration = message.includes("does not exist") || message.includes("schema cache") || message.includes("relation") || message.includes("column");
      return toast.error(
        needsMigration
          ? "Courses are not set up yet. Apply the SQL below in Supabase, then try again."
          : "Could not create course. Check your course details and try again.",
      );
    }
    setTitle("");
    setDescription("");
    setRepoUrl("");
    await loadCourses();
    toast.success("Course created as a draft.");
  };

  const addLesson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse || !lessonTitle.trim())
      return toast.error("Choose a course and add a lesson title.");
    setLessonBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("course_lessons").insert({
      course_id: selectedCourse,
      title: lessonTitle.trim(),
      content: lessonContent.trim(),
      position: 1,
    });
    setLessonBusy(false);
    if (error) return toast.error("Could not add lesson. Apply the course SQL first.");
    setLessonTitle("");
    setLessonContent("");
    toast.success(`Lesson added for ${userData.user?.email ?? "your students"}.`);
  };

  const uploadLessonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCourse) return;
    setUploadBusy(true);
    const { data } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", selectedCourse);
    const response = await fetch("/api/teacher/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: formData,
    });
    const result = (await response.json()) as {
      pathname?: string;
      filename?: string;
      contentType?: string;
      error?: string;
    };
    setUploadBusy(false);
    if (!response.ok || !result.pathname) return toast.error(result.error ?? "Upload failed.");
    const { error } = await (supabase as any).from("course_lessons").insert({
      course_id: selectedCourse,
      title: result.filename ?? file.name,
      content: "Uploaded lesson resource",
      position: 1,
      asset_path: result.pathname,
      asset_name: result.filename ?? file.name,
      asset_content_type: result.contentType ?? file.type,
    });
    if (error) return toast.error("File uploaded, but lesson could not be saved.");
    toast.success("File added as a lesson resource.");
  };

  const updateEnrollment = async (enrollment: Enrollment, status: "accepted" | "rejected") => {
    const { error } = await (supabase as any).from("course_enrollments").update({ status }).eq("id", enrollment.id);
    if (error) return toast.error("Could not update enrollment.");
    setEnrollments((items) => items.map((item) => item.id === enrollment.id ? { ...item, status } : item));
    toast.success(status === "accepted" ? "Student accepted." : "Enrollment declined.");
  };

  const togglePublished = async (course: Course) => {
    const { error } = await (supabase as any)
      .from("courses")
      .update({ published: !course.published })
      .eq("id", course.id);
    if (error) toast.error("Could not update course.");
    else
      setCourses((items) =>
        items.map((item) =>
          item.id === course.id ? { ...item, published: !item.published } : item,
        ),
      );
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-stretch justify-between gap-5 sm:mb-10 sm:flex-row sm:items-start sm:gap-4">
          <div>
            <p className="mb-2 text-sm text-primary">TEACHER STUDIO</p>
            <h1 className="max-w-xl font-display text-3xl font-semibold sm:text-4xl">Teach what you know.</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Create free courses, share practical lessons, and help the next developer level up.
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline">Back to app</Button>
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="bento-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                <Plus />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Create a course</h2>
                <p className="text-sm text-muted-foreground">
                  Start with a clear learning outcome.
                </p>
              </div>
            </div>
            <form onSubmit={createCourse} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="JavaScript foundations"
                />
              </div>
              <div>
                <Label htmlFor="course-description">Description</Label>
                <Textarea
                  id="course-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will students build?"
                />
              </div>
              <div>
                <Label htmlFor="course-repository">GitHub repository</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Github className="size-4 text-muted-foreground" />
                  <Input id="course-repository" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/project" type="url" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Share the starter code or project repository with students.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="course-paid">Paid course</Label>
                  <p className="text-xs text-muted-foreground">Turn this off to offer it free.</p>
                </div>
                <input id="course-paid" type="checkbox" checked={!isFree} onChange={(e) => setIsFree(!e.target.checked)} className="h-4 w-4 accent-primary" />
              </div>
              {!isFree && (
                <div>
                  <Label htmlFor="course-price">Price</Label>
                  <Input id="course-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.00" />
                </div>
              )}
              <Button disabled={busy}>{busy ? "Creating…" : "Create draft"}</Button>
            </form>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">Your courses</h2>
                <p className="text-sm text-muted-foreground">
                  Publish when your first lesson is ready.
                </p>
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <GraduationCap /> Free learning
              </div>
            </div>
            {courses.length === 0 ? (
              <div className="bento-card flex flex-col items-center gap-3 p-12 text-center">
                <BookOpen className="text-primary" />
                <p className="font-medium">Your teaching library is empty.</p>
                <p className="text-sm text-muted-foreground">
                  Create your first course to invite students.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {courses.map((course) => (
                  <article
                    key={course.id}
                    className="bento-card flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
                  >
                    <div>
                      <h3 className="font-semibold">{course.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {course.description || "No description yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCourse(course.id)}
                      >
                        Add content
                      </Button>
                      <Button
                        variant={course.published ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => void togglePublished(course)}
                      >
                        {course.published ? "Published" : "Publish"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {enrollments.length > 0 && (
              <section className="bento-card mt-5 p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h2 className="font-display text-xl font-semibold">Student requests</h2><p className="text-sm text-muted-foreground">Approve paid enrollments before lessons are unlocked.</p></div>
                  <GraduationCap className="text-primary" />
                </div>
                <div className="grid gap-3">
                  {enrollments.map((enrollment) => <div key={enrollment.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-medium">{enrollment.student?.display_name ?? enrollment.student?.username ?? "Student"}</p><p className="text-xs text-muted-foreground">{courses.find((course) => course.id === enrollment.course_id)?.title ?? "Course"} · {enrollment.status}</p></div>
                    {enrollment.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => void updateEnrollment(enrollment, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => void updateEnrollment(enrollment, "rejected")}>Decline</Button></div>}
                  </div>)}
                </div>
              </section>
            )}
            {selectedCourse && (
              <section className="bento-card mt-5 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Video className="text-primary" />
                  <div>
                    <h3 className="font-display text-lg font-semibold">Build course content</h3>
                    <p className="text-sm text-muted-foreground">
                      Add text lessons, PDFs, slides, audio, or videos.
                    </p>
                  </div>
                </div>
                <form onSubmit={addLesson} className="flex flex-col gap-3">
                  <Input
                    value={lessonTitle}
                    onChange={(event) => setLessonTitle(event.target.value)}
                    placeholder="Lesson title"
                  />
                  <Textarea
                    value={lessonContent}
                    onChange={(event) => setLessonContent(event.target.value)}
                    placeholder="Lesson notes or instructions"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={lessonBusy}>{lessonBusy ? "Saving…" : "Add lesson"}</Button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                      <FileUp /> {uploadBusy ? "Uploading…" : "Upload file or video"}
                      <input
                        type="file"
                        accept="video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx,.zip"
                        className="sr-only"
                        onChange={(event) => void uploadLessonFile(event)}
                      />
                    </label>
                    <Button type="button" variant="ghost" onClick={() => setSelectedCourse(null)}>
                      Close
                    </Button>
                  </div>
                </form>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
