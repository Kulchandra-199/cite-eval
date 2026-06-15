"use client";

import { useRouter } from "next/navigation";
import CreateEvaluation from "@/components/CreateEvaluation";
import { useReports } from "@/context/ReportsContext";

export default function NewEvaluationPage() {
  const router = useRouter();
  const { handleEvaluationFormSubmit } = useReports();

  return (
    <CreateEvaluation
      onBack={() => router.push("/")}
      onSubmit={handleEvaluationFormSubmit}
    />
  );
}
