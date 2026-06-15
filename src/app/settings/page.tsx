"use client";

import { useRouter } from "next/navigation";
import SettingsView from "@/components/SettingsView";
import { useReports } from "@/context/ReportsContext";

export default function SettingsPage() {
  const router = useRouter();
  const { defaultEvaluator, setDefaultEvaluator, handleClearStorage } =
    useReports();

  return (
    <SettingsView
      onBack={() => router.push("/")}
      currentEvaluator={defaultEvaluator}
      onChangeEvaluator={setDefaultEvaluator}
      onClearStorage={handleClearStorage}
    />
  );
}
