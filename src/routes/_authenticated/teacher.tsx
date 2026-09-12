import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileUp, GraduationCap, Plus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher")({ component: TeacherDashboard });

type Course = { id: string; title: string; description: string; level: string; published: boolean };

function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);

  const loadCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id,title,description,level,published")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load courses.");
    else setCourses((data ?? []) as Course[]);
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  const createCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("Add a course title.");
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("courses").insert({
      teacher_id: userData.user?.id,
      title: title.trim(),
      description: description.trim(),
    });
    setBusy(false);
    if (error) return toast.error("Could not create course. Apply the teaching migration first.");
    setTitle("");
    setDescription("");
    await loadCourses();
    toast.success("Course created as a draft.");
  };

  const addLesson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse || !lessonTitle.trim())
      return toast.error("Choose a course and add a lesson title.");
    setLessonBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("course_lessons").insert({
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
    setLessonBusy(true);
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
    setLessonBusy(false);
    if (!response.ok || !result.pathname) return toast.error(result.error ?? "Upload failed.");
    const { error } = await supabase.from("course_lessons").insert({
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

  const togglePublished = async (course: Course) => {
    const { error } = await supabase
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
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-primary">TEACHER STUDIO</p>
            <h1 className="font-display text-4xl font-semibold">Teach what you know.</h1>
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
                    className="bento-card flex items-center justify-between gap-4 p-5"
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
                      <FileUp /> Upload file or video
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
