import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Github, LockKeyhole, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({ component: CourseLearningPage });

type Course = { id: string; title: string; description: string; level: string; is_free: boolean; price: number; repo_url?: string | null };
type Lesson = { id: string; title: string; content: string | null; position: number; asset_path?: string | null };

function CourseLearningPage() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [{ data: courseData }, { data: lessonData }] = await Promise.all([
        (supabase as any).from("courses").select("id,title,description,level,is_free,price,repo_url").eq("id", courseId).maybeSingle(),
        (supabase as any).from("course_lessons").select("id,title,content,position,asset_path").eq("course_id", courseId).order("position", { ascending: true }),
      ]);
      const { data: user } = await supabase.auth.getUser();
      const { data: enrollment } = user.user ? await (supabase as any).from("course_enrollments").select("status").eq("course_id", courseId).eq("student_id", user.user.id).maybeSingle() : { data: null };
      if (!enrollment || enrollment.status !== "accepted") toast.error("This course is only available to enrolled students.");
      setCourse(courseData as Course | null);
      setLessons((lessonData ?? []) as Lesson[]);
      setLoading(false);
    })();
  }, [courseId]);

  if (loading) return <main className="min-h-screen bg-background p-6 text-muted-foreground">Loading course…</main>;
  if (!course) return <main className="min-h-screen bg-background p-6"><p>Course not found.</p><Link to="/courses"><Button className="mt-4">Back to courses</Button></Link></main>;

  return <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <Link to="/courses" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to courses</Link>
      <header className="bento-card mb-6 overflow-hidden p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><PlayCircle className="size-4" /> {course.level} · {course.is_free ? "Free" : `$${Number(course.price).toFixed(2)}`}</div>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold sm:text-5xl">{course.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{course.description || "A practical course from the DevPulse community."}</p>
        {course.repo_url && <a href={course.repo_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:underline"><Github className="size-4" /> Open course repository</a>}
      </header>
      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <aside className="bento-card h-fit p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Course map</p><h2 className="mt-2 font-display text-2xl font-semibold">{lessons.length} lessons</h2><p className="mt-2 text-sm text-muted-foreground">Work through each lesson at your own pace.</p><div className="mt-5 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="size-4" /> Enrolled and unlocked</div></aside>
        <div className="space-y-3">{lessons.length ? lessons.map((lesson, index) => <article key={lesson.id} className="bento-card p-5 sm:p-6"><div className="flex gap-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{index + 1}</span><div className="min-w-0"><h2 className="font-display text-xl font-semibold">{lesson.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{lesson.content || "This lesson is ready to explore."}</p>{lesson.asset_path && <a href={lesson.asset_path} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open lesson resource</a>}</div></div></article>) : <div className="bento-card p-10 text-center"><LockKeyhole className="mx-auto mb-3 text-primary" /><p className="font-medium">Lessons are coming soon.</p><p className="mt-1 text-sm text-muted-foreground">Your teacher has not published lesson content yet.</p></div>}</div>
      </section>
    </div>
  </main>;
}
