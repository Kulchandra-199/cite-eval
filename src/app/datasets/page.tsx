"use client";

import { useRouter } from "next/navigation";
import DatasetsView from "@/components/DatasetsView";
import { useReports } from "@/context/ReportsContext";

export default function DatasetsPage() {
  const router = useRouter();
  const { handleEvaluateDataset } = useReports();

  return (
    <DatasetsView
      onBack={() => router.push("/")}
      onEvaluateDataset={handleEvaluateDataset}
    />
  );
}
