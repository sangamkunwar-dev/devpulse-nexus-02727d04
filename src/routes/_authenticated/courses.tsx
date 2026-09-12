import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses")({ component: CoursesPage });
type Course = { id: string; title: string; description: string; level: string };

function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolled, setEnrolled] = useState<string[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,title,description,level")
        .eq("published", true)
        .order("created_at", { ascending: false });
      setCourses((data ?? []) as Course[]);
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data: rows } = await supabase
          .from("course_enrollments")
          .select("course_id")
          .eq("student_id", user.user.id);
        setEnrolled((rows ?? []).map((row) => row.course_id));
      }
    })();
  }, []);
  const enroll = async (courseId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase
      .from("course_enrollments")
      .insert({ course_id: courseId, student_id: user.user.id });
    if (error && !error.message.includes("duplicate")) toast.error("Could not join course.");
    else {
      setEnrolled((items) => [...items, courseId]);
      toast.success("You joined the course.");
    }
  };
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-start justify-between">
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
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {course.description}
                  </p>
                </div>
                <Button
                  onClick={() => void enroll(course.id)}
                  disabled={enrolled.includes(course.id)}
                >
                  {enrolled.includes(course.id) ? (
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
