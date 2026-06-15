"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EvaluationProgress from "@/components/EvaluationProgress";
import { useReports } from "@/context/ReportsContext";

export default function EvaluationProgressPage() {
  const router = useRouter();
  const { activeEvaluation, pendingEvaluation, handleProgressComplete } =
    useReports();

  useEffect(() => {
    if (!activeEvaluation && !pendingEvaluation) {
      router.replace("/");
    }
  }, [activeEvaluation, pendingEvaluation, router]);

  useEffect(() => {
    if (activeEvaluation?.isComplete) {
      const timer = setTimeout(() => handleProgressComplete(), 600);
      return () => clearTimeout(timer);
    }
  }, [activeEvaluation?.isComplete, handleProgressComplete]);

  if (!activeEvaluation) {
    return null;
  }

  return <EvaluationProgress onViewReport={() => {}} />;
}
