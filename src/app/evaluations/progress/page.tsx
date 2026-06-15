"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EvaluationProgress from "@/components/EvaluationProgress";
import { useReports } from "@/context/ReportsContext";

export default function EvaluationProgressPage() {
  const router = useRouter();
  const { pendingEvaluation, handleProgressComplete } = useReports();

  useEffect(() => {
    if (!pendingEvaluation) {
      router.replace("/");
    }
  }, [pendingEvaluation, router]);

  if (!pendingEvaluation) {
    return null;
  }

  return (
    <EvaluationProgress
      reportName={pendingEvaluation.name}
      evaluator={pendingEvaluation.evaluator}
      facts={pendingEvaluation.facts}
      onComplete={handleProgressComplete}
    />
  );
}
