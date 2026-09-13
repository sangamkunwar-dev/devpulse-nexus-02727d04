import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Github, PlayCircle } from "lucide-react";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment["status"]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [teachers, setTeachers] = useState<Record<string, Teacher>>({});

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

  useEffect(() => {
    let userId = "";
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? "";
      if (!userId) return;
      channel = supabase.channel("student-course-enrollments").on("postgres_changes", { event: "*", schema: "public", table: "course_enrollments", filter: `student_id=eq.${userId}` }, (payload) => {
        const row = payload.new as Enrollment;
        if (row.course_id) setEnrollments((items) => ({ ...items, [row.course_id]: row.status }));
      }).subscribe();
    });
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, []);

  const removeEnrollment = async (courseId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return toast.error("Please sign in before changing enrollment.");
    const { error } = await (supabase as any).from("course_enrollments").delete().eq("course_id", courseId).eq("student_id", user.user.id);
    if (error) return toast.error("Could not remove your request.");
    setEnrollments((items) => { const next = { ...items }; delete next[courseId]; return next; });
    toast.success("Enrollment removed. You can join again anytime.");
  };

  const enroll = async (courseId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return toast.error("Please sign in before joining a course.");
    const { error } = await (supabase as any)
      .from("course_enrollments")
      .insert({ course_id: courseId, student_id: user.user.id, status: "pending" });
    if (error && !error.message.includes("duplicate")) return toast.error("Could not send enrollment request.");
    setEnrollments((items) => ({ ...items, [courseId]: "pending" }));
    toast.success("Enrollment request sent. Wait for the teacher to accept you.");
  };
  if (pathname !== "/courses") {
    return <Outlet />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col items-stretch justify-between gap-4 sm:mb-10 sm:flex-row sm:items-start sm:gap-4">
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
                <article id={`enrolled-course-${course.id}`} key={`enrolled-${course.id}`} className="bento-card flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div>
                    <p className="text-xs font-medium text-primary">ENROLLED</p>
                    <h3 className="mt-1 font-display text-xl font-semibold">{course.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">By {teachers[course.teacher_id]?.display_name ?? teachers[course.teacher_id]?.username ?? "Community teacher"}</p>
                  </div>
<Link to="/courses/$courseId" params={{ courseId: course.id }}>
                  <Button variant="secondary"><PlayCircle data-icon="inline-start" /> Continue learning</Button>
                </Link>
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
            {courses.filter((course) => enrollments[course.id] !== "accepted").map((course) => (
              <article key={course.id} className="bento-card flex flex-col gap-5 p-6">
                <div>
                  <span className="text-xs text-primary">{course.level}</span>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{course.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">By {teachers[course.teacher_id]?.display_name ?? teachers[course.teacher_id]?.username ?? "Community teacher"}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {course.description}
                  </p>
                  <div className="mt-4 text-sm font-medium text-primary">Free enrollment</div>
                </div>
                {enrollments[course.id] === "accepted" ? (
                  <Link to="/courses/$courseId" params={{ courseId: course.id }} className="block">
                    <Button variant="secondary" className="w-full">
                      <PlayCircle data-icon="inline-start" />
                      Continue course
                    </Button>
                  </Link>
                ) : enrollments[course.id] === "pending" ? (
                  <Button variant="outline" className="w-full" onClick={() => void removeEnrollment(course.id)}>
                    <CheckCircle2 data-icon="inline-start" /> Request pending · Cancel
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => void enroll(course.id)}>
                    {enrollments[course.id] === "rejected" ? "Request again" : "Join course"}
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <Outlet />
    </main>
  );
}
