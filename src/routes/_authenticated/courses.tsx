import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Github, LockKeyhole, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses")({ component: CoursesPage });
type Course = {
  id: string;
  title: string;
  description: string;
  level: string;
  is_free: boolean;
  price: number;
  teacher_id: string;
  repo_url?: string | null;
};
type Enrollment = { course_id: string; status: "pending" | "accepted" | "rejected" };
type Lesson = { id: string; course_id: string; title: string; content: string | null; position: number; asset_path?: string | null };
type Teacher = { user_id: string; username: string; display_name: string | null };

function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment["status"]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [teachers, setTeachers] = useState<Record<string, Teacher>>({});
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any)
        .from("courses")
        .select("id,title,description,level,is_free,price,teacher_id,repo_url")
        .eq("published", true)
        .order("created_at", { ascending: false });
      const loadedCourses = (data ?? []) as Course[];
      setCourses(loadedCourses);
      const teacherIds = [...new Set(loadedCourses.map((course) => course.teacher_id).filter(Boolean))];
      if (teacherIds.length) {
        const { data: profiles } = await (supabase as any).from("profiles").select("user_id,username,display_name").in("user_id", teacherIds);
        setTeachers(Object.fromEntries((profiles ?? []).map((profile: Teacher) => [profile.user_id, profile as Teacher])));
      }
      if (loadedCourses.length) {
        const { data: lessonRows } = await (supabase as any).from("course_lessons").select("id,course_id,title,content,position,asset_path").in("course_id", loadedCourses.map((course) => course.id)).order("position", { ascending: true });
        const grouped = (lessonRows ?? []).reduce((result: Record<string, Lesson[]>, lesson: Lesson) => {
          (result[lesson.course_id] ??= []).push(lesson as Lesson);
          return result;
        }, {});
        setLessons(grouped);
      }
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
          const { data: rows } = await (supabase as any)
          .from("course_enrollments")
          .select("course_id,status")
          .eq("student_id", user.user.id);
        setEnrollments(Object.fromEntries((rows ?? []).map((row: Enrollment) => [row.course_id, row.status])));
      }
    })();
  }, []);
  const enroll = async (courseId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await (supabase as any)
      .from("course_enrollments")
      .insert({ course_id: courseId, student_id: user.user.id, status: courses.find((course) => course.id === courseId)?.is_free ? "accepted" : "pending" });
    if (error && !error.message.includes("duplicate")) toast.error("Could not join course.");
    else {
      setEnrolled((items) => [...items, courseId]);
      toast.success("You joined the course.");
    }
  };
  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col items-stretch justify-between gap-5 sm:mb-10 sm:flex-row sm:items-start sm:gap-4">
          <div>
            <p className="mb-2 text-sm text-primary">FREE LEARNING</p>
            <h1 className="font-display text-4xl font-semibold">Learn from the community.</h1>
            <p className="mt-2 text-muted-foreground">
              Practical courses from teachers building in public.
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline">Back to app</Button>
          </Link>
        </div>
        {Object.keys(enrollments).length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <PlayCircle className="text-primary" />
              <div>
                <h2 className="font-display text-2xl font-semibold">My enrolled courses</h2>
                <p className="text-sm text-muted-foreground">Pick up where you left off.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {courses.filter((course) => enrollments[course.id] === "accepted").map((course) => (
                <article key={`enrolled-${course.id}`} className="bento-card flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div>
                    <p className="text-xs font-medium text-primary">ENROLLED</p>
                    <h3 className="mt-1 font-display text-xl font-semibold">{course.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">By {teachers[course.teacher_id]?.display_name ?? teachers[course.teacher_id]?.username ?? "Community teacher"}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setOpenCourse(openCourse === course.id ? null : course.id)}>
                    {openCourse === course.id ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                    {openCourse === course.id ? "Hide lessons" : "Continue"}
                  </Button>
                  {openCourse === course.id && (
                    <div className="col-span-full mt-2 border-t border-border pt-4">
                      <p className="mb-3 text-sm font-medium">All lessons</p>
                      {lessons[course.id]?.length ? (
                        <ol className="flex flex-col gap-2">
                          {lessons[course.id].map((lesson, index) => (
                            <li key={lesson.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                              <span className="mr-2 text-primary">{index + 1}.</span>{lesson.title}
                              {lesson.content && <p className="mt-1 text-xs text-muted-foreground">{lesson.content}</p>}
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-sm text-muted-foreground">No lessons have been added yet.</p>}
                      {course.repo_url && (
                        <a href={course.repo_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                          <Github className="size-4" /> Open GitHub repository
                        </a>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {courses.length === 0 ? (
          <div className="bento-card p-12 text-center">
            <BookOpen className="mx-auto mb-3 text-primary" />
            <p className="font-medium">No published courses yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for new lessons.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="bento-card flex flex-col gap-5 p-6">
                <div>
                  <span className="text-xs text-primary">{course.level}</span>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{course.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">By {teachers[course.teacher_id]?.display_name ?? teachers[course.teacher_id]?.username ?? "Community teacher"}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {course.description}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                    {course.is_free ? (
                      <span className="text-primary">Free</span>
                    ) : (
                      <><LockKeyhole className="size-4 text-primary" /> ${Number(course.price || 0).toFixed(2)}</>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => void enroll(course.id)}
                  disabled={Boolean(enrollments[course.id])}
                >
                  {enrollments[course.id] ? (
                    <>
                      <CheckCircle2 data-icon="inline-start" />
                      Enrolled
                    </>
                  ) : (
                    "Join course"
                  )}
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
